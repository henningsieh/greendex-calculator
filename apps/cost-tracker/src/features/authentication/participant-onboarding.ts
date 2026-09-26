import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { hasOrganizationRole } from "@greendex/auth";
import { db } from "@greendex/database";
import {
  claimsTable,
  invitation,
  member,
  participantAgreementAcceptancesTable as acceptances,
  participantInvitationBridgesTable as bridges,
  participantProfilesTable as profiles,
  participantRegistrationLinksTable as links,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
  isPublishedAgreement,
  type ParticipantAgreementVersion,
} from "@/features/authentication/participant-agreement";
import { requirePartnerCoordination } from "@/features/projects/procedures/coordination";
import { auth } from "@/lib/auth";
import { authorized } from "@/lib/orpc/middleware";

const id = z.string().min(1).max(128);
const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email());
const secretHash = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
const success = z.object({ success: z.literal(true) });
const profileInput = z.object({ fullName: z.string().trim().min(1).max(200) });
const agreementInput = z.object({ accepted: z.literal(true) });
const joinInput = z.object({
  profile: profileInput,
  agreement: agreementInput,
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("link"), id, secret: z.string().min(1) }),
    z.object({ kind: z.literal("invitation"), invitationId: id }),
  ]),
});

// Tests can supply a published fixture; the deployed value is deliberately unpublishable.
export function createParticipantOnboardingProcedures(
  currentAgreement: () => ParticipantAgreementVersion = () =>
    CURRENT_PARTICIPANT_AGREEMENT_VERSION,
) {
  function requirePublishedAgreement(errors: {
    BAD_REQUEST: (args: { message: string }) => Error;
  }) {
    const version = currentAgreement();
    if (!isPublishedAgreement(version))
      throw errors.BAD_REQUEST({
        message: "Participant agreement is not yet available.",
      });
    return version;
  }

  const acceptAgreement = authorized
    .input(agreementInput)
    .output(z.object({ version: z.string() }))
    .handler(async ({ context, errors }) => {
      const version = requirePublishedAgreement(errors);
      await db
        .insert(acceptances)
        .values({
          userId: context.user.id,
          version: version.id,
          contentHash: version.contentHash,
          answers: JSON.stringify({ accepted: true }),
        })
        .onConflictDoNothing();
      return { version: version.id };
    });

  const saveProfile = authorized
    .input(profileInput)
    .output(success)
    .handler(async ({ context, input }) => {
      await db
        .insert(profiles)
        .values({ userId: context.user.id, fullName: input.fullName })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: { fullName: input.fullName, updatedAt: new Date() },
        });
      return { success: true as const };
    });

  async function partnershipForIssuer(
    partnershipId: string,
    userId: string,
    activeOrganizationId: string | null | undefined,
    errors: { FORBIDDEN: (args: { message: string }) => Error },
  ) {
    const [partnership] = await db
      .select({
        id: partnerships.id,
        projectId: partnerships.projectId,
        partnerId: partnerships.organizationId,
        hostId: projects.organizationId,
        responsibleUserId: projects.responsibleUserId,
        archived: projects.archived,
      })
      .from(partnerships)
      .innerJoin(projects, eq(projects.id, partnerships.projectId))
      .where(eq(partnerships.id, partnershipId))
      .limit(1);
    if (
      !partnership ||
      partnership.archived ||
      (activeOrganizationId !== partnership.partnerId &&
        activeOrganizationId !== partnership.hostId)
    )
      throw errors.FORBIDDEN({ message: "Project Partnership is unavailable." });
    const roles = await db
      .select({ organizationId: member.organizationId, role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          or(
            eq(member.organizationId, partnership.partnerId),
            eq(member.organizationId, partnership.hostId),
          ),
        ),
      );
    const permitted =
      roles.some(
        ({ organizationId, role }) =>
          organizationId === activeOrganizationId &&
          (hasOrganizationRole(role, "owner") ||
            hasOrganizationRole(role, "admin")),
      ) ||
      (partnership.responsibleUserId === userId &&
        activeOrganizationId === partnership.hostId &&
        roles.some(
          ({ organizationId, role }) =>
            organizationId === partnership.hostId &&
            role
              .split(",")
              .some((value) =>
                ["owner", "admin", "member", "project-coordinator"].includes(
                  value.trim(),
                ),
              ),
        ));
    if (!permitted) {
      await requirePartnerCoordination(
        partnershipId,
        userId,
        activeOrganizationId,
        errors,
      );
    }
    return {
      ...partnership,
      hostCanInvite:
        activeOrganizationId === partnership.hostId &&
        roles.some(
          ({ organizationId, role }) =>
            organizationId === partnership.hostId &&
            (hasOrganizationRole(role, "owner") ||
              hasOrganizationRole(role, "admin")),
        ),
    };
  }

  const createRegistrationLink = authorized
    .input(z.object({ partnershipId: id }))
    .output(z.object({ id: z.string(), secret: z.string() }))
    .handler(async ({ input, context, errors }) => {
      await partnershipForIssuer(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      const [existing] = await db
        .select({ id: links.id })
        .from(links)
        .where(eq(links.partnershipId, input.partnershipId))
        .limit(1);
      if (existing)
        throw errors.BAD_REQUEST({
          message:
            "This Partnership already has a registration link; distribute the existing secret securely.",
        });
      const secret = randomBytes(32).toString("base64url");
      const [link] = await db
        .insert(links)
        .values({
          partnershipId: input.partnershipId,
          secretHash: secretHash(secret),
          createdByUserId: context.user.id,
        })
        .returning({ id: links.id });
      return { id: link!.id, secret };
    });

  const setRegistrationLinkOpen = authorized
    .input(z.object({ id, open: z.boolean() }))
    .output(z.object({ open: z.boolean() }))
    .handler(async ({ input, context, errors }) => {
      const [link] = await db
        .select({ partnershipId: links.partnershipId })
        .from(links)
        .where(eq(links.id, input.id))
        .limit(1);
      if (!link) throw errors.NOT_FOUND();
      await partnershipForIssuer(
        link.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (input.open) {
        const [claim] = await db
          .select({ status: claimsTable.status })
          .from(claimsTable)
          .where(eq(claimsTable.partnershipId, link.partnershipId))
          .limit(1);
        if (claim && claim.status !== "editable")
          throw errors.BAD_REQUEST({
            message: "A submitted Claim prevents reopening registration.",
          });
      }
      await db
        .update(links)
        .set({
          enabled: input.open,
          closedAt: input.open ? null : new Date(),
          closedByUserId: input.open ? null : context.user.id,
        })
        .where(eq(links.id, input.id));
      return { open: input.open };
    });

  const issueInvitation = authorized
    .input(z.object({ partnershipId: id, email: normalizedEmail }))
    .output(z.object({ invitationId: z.string() }))
    .handler(async ({ input, context, errors }) => {
      const partnership = await partnershipForIssuer(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      const [existingParticipation] = await db
        .select({ id: participants.id })
        .from(participants)
        .leftJoin(user, eq(user.id, participants.userId))
        .where(
          and(
            eq(participants.projectId, partnership.projectId),
            or(eq(participants.email, input.email), eq(user.email, input.email)),
          ),
        )
        .limit(1);
      if (existingParticipation)
        throw errors.BAD_REQUEST({
          message: "This person already participates in this Project.",
        });
      const [existingBridge] = await db
        .select({
          invitationId: bridges.invitationId,
          partnershipId: bridges.partnershipId,
        })
        .from(bridges)
        .where(
          and(
            eq(bridges.projectId, partnership.projectId),
            eq(bridges.email, input.email),
            eq(bridges.status, "pending"),
          ),
        )
        .limit(1);
      if (existingBridge) {
        if (existingBridge.partnershipId !== partnership.id)
          throw errors.BAD_REQUEST({
            message: "This person already has an invitation to this Project.",
          });
        return { invitationId: existingBridge.invitationId };
      }
      // TODO (#174): wire actual invitation email delivery and the recipient accept surface.
      // Cost Tracker's Better Auth config currently has no invitation-email sender.
      let invitationId: string;
      if (partnership.hostCanInvite) {
        const response = await auth.api.createInvitation({
          asResponse: true,
          headers: context.headers,
          body: {
            email: input.email,
            role: "participant",
            organizationId: partnership.hostId,
          },
        });
        if (!response.ok)
          throw errors.BAD_REQUEST({
            message: "Better Auth invitation issuance failed.",
          });
        invitationId = z
          .object({ id: z.string() })
          .parse(await response.json()).id;
        await db.insert(bridges).values({
          invitationId,
          partnershipId: partnership.id,
          projectId: partnership.projectId,
          email: input.email,
          issuedByUserId: context.user.id,
        });
      } else {
        // Partner issuers cannot call BA's host-only invite endpoint. Write the native
        // invitation shape plus bridge atomically, under the verified issuer guard.
        invitationId = randomUUID();
        await db.transaction(async (tx) => {
          await tx.insert(invitation).values({
            id: invitationId,
            organizationId: partnership.hostId,
            email: input.email,
            role: "participant",
            status: "pending",
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            inviterId: context.user.id,
          });
          await tx.insert(bridges).values({
            invitationId,
            partnershipId: partnership.id,
            projectId: partnership.projectId,
            email: input.email,
            issuedByUserId: context.user.id,
          });
        });
      }
      console.info("Participant invitation issued", {
        issuer: context.user.id,
        recipient: input.email,
        partnershipId: partnership.id,
        at: new Date().toISOString(),
      });
      return { invitationId };
    });

  const setInvitationOpen = authorized
    .input(z.object({ invitationId: id, open: z.boolean() }))
    .output(z.object({ open: z.boolean() }))
    .handler(async ({ input, context, errors }) => {
      const [bridge] = await db
        .select({ partnershipId: bridges.partnershipId, status: bridges.status })
        .from(bridges)
        .where(eq(bridges.invitationId, input.invitationId))
        .limit(1);
      if (!bridge) throw errors.NOT_FOUND();
      await partnershipForIssuer(
        bridge.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (bridge.status === "accepted")
        throw errors.BAD_REQUEST({
          message: "Accepted invitations cannot be changed.",
        });
      const [native] = await db
        .select({ status: invitation.status, expiresAt: invitation.expiresAt })
        .from(invitation)
        .where(eq(invitation.id, input.invitationId))
        .limit(1);
      if (
        !native ||
        native.status !== "pending" ||
        native.expiresAt <= new Date()
      )
        throw errors.BAD_REQUEST({ message: "Invitation is unavailable." });
      await db
        .update(bridges)
        .set({ status: input.open ? "pending" : "revoked" })
        .where(eq(bridges.invitationId, input.invitationId));
      return { open: input.open };
    });

  const join = authorized
    .input(joinInput)
    .output(z.object({ participationId: z.string() }))
    .handler(async ({ context, input, errors }) => {
      const version = requirePublishedAgreement(errors);
      if (!context.user.emailVerified)
        throw errors.FORBIDDEN({ message: "Verify your email before joining." });
      let partnershipId: string;
      let bridgeId: string | undefined;
      if (input.source.kind === "link") {
        const [link] = await db
          .select()
          .from(links)
          .where(eq(links.id, input.source.id))
          .limit(1);
        if (!link || link.secretHash !== secretHash(input.source.secret))
          throw errors.NOT_FOUND({ message: "Registration link not found." });
        if (!link.enabled)
          throw errors.BAD_REQUEST({ message: "Registration link is closed." });
        partnershipId = link.partnershipId;
      } else {
        const [bridge] = await db
          .select()
          .from(bridges)
          .where(eq(bridges.invitationId, input.source.invitationId))
          .limit(1);
        if (!bridge || bridge.email !== context.user.email.trim().toLowerCase())
          throw errors.FORBIDDEN({
            message: "Invitation is not for this account.",
          });
        if (bridge.status !== "pending" && bridge.status !== "accepted")
          throw errors.BAD_REQUEST({ message: "Invitation is closed." });
        const [nativeInvitation] = await db
          .select({ expiresAt: invitation.expiresAt, status: invitation.status })
          .from(invitation)
          .where(eq(invitation.id, bridge.invitationId))
          .limit(1);
        if (
          !nativeInvitation ||
          (bridge.status === "pending" &&
            nativeInvitation.expiresAt <= new Date())
        )
          throw errors.BAD_REQUEST({
            message: "Invitation is expired or unavailable.",
          });
        if (
          bridge.status === "pending" &&
          nativeInvitation.status !== "pending" &&
          nativeInvitation.status !== "accepted"
        )
          throw errors.BAD_REQUEST({ message: "Invitation is closed." });
        partnershipId = bridge.partnershipId;
        bridgeId = bridge.invitationId;
      }
      const [partnership] = await db
        .select({
          projectId: partnerships.projectId,
          partnerId: partnerships.organizationId,
          hostId: projects.organizationId,
          archived: projects.archived,
        })
        .from(partnerships)
        .innerJoin(projects, eq(projects.id, partnerships.projectId))
        .where(eq(partnerships.id, partnershipId))
        .limit(1);
      if (!partnership || partnership.archived)
        throw errors.BAD_REQUEST({ message: "Project is unavailable." });
      const [previous] = await db
        .select({
          id: participants.id,
          partnerId: participants.representedOrganizationId,
        })
        .from(participants)
        .where(
          and(
            eq(participants.projectId, partnership.projectId),
            eq(participants.userId, context.user.id),
          ),
        )
        .limit(1);
      if (previous && previous.partnerId !== partnership.partnerId)
        throw errors.BAD_REQUEST({
          message:
            "You already joined this Project through another Partner Organization.",
        });
      if (bridgeId && !previous) {
        const [existingMembership] = await db
          .select({ id: member.id })
          .from(member)
          .where(
            and(
              eq(member.organizationId, partnership.hostId),
              eq(member.userId, context.user.id),
            ),
          )
          .limit(1);
        if (!existingMembership) {
          const response = await auth.api.acceptInvitation({
            asResponse: true,
            headers: context.headers,
            body: { invitationId: bridgeId },
          });
          if (!response.ok)
            throw errors.BAD_REQUEST({
              message: "Better Auth invitation acceptance failed; please retry.",
            });
        }
      }
      const [membership] = await db
        .select({ id: member.id, role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, partnership.hostId),
            eq(member.userId, context.user.id),
          ),
        )
        .limit(1);
      if (!membership) {
        const response = await auth.api.addMember({
          asResponse: true,
          body: {
            userId: context.user.id,
            organizationId: partnership.hostId,
            role: "participant",
          },
        });
        if (!response.ok)
          throw errors.BAD_REQUEST({
            message: "Membership creation failed; please retry.",
          });
        console.info("Participant membership created", {
          actor: context.user.id,
          linkId: input.source.kind === "link" ? input.source.id : bridgeId,
          previousRole: null,
          newRole: "participant",
          at: new Date().toISOString(),
        });
      } else if (membership.role === "member") {
        // Role matrix: newcomer gets participant; plain member gains participant;
        // participant, owner and admin are reused unchanged. Project scope always comes from Participation.
        const authContext = await auth.$context;
        const updated = await authContext.adapter.update({
          model: "member",
          where: [
            { field: "id", value: membership.id },
            { field: "role", value: "member" },
          ],
          update: { role: "member,participant" },
        });
        if (!updated)
          throw errors.BAD_REQUEST({
            message: "Membership changed; please retry onboarding.",
          });
        console.info("Participant membership updated", {
          actor: context.user.id,
          linkId: input.source.kind === "link" ? input.source.id : bridgeId,
          previousRole: "member",
          newRole: "member,participant",
          at: new Date().toISOString(),
        });
      }
      return db.transaction(async (tx) => {
        if (input.source.kind === "link") {
          const [link] = await tx
            .select({ enabled: links.enabled })
            .from(links)
            .where(
              and(
                eq(links.id, input.source.id),
                eq(links.partnershipId, partnershipId),
              ),
            )
            .for("update")
            .limit(1);
          if (!link?.enabled)
            throw errors.BAD_REQUEST({ message: "Registration link is closed." });
        } else {
          const [bridge] = await tx
            .select({ status: bridges.status })
            .from(bridges)
            .where(eq(bridges.invitationId, bridgeId!))
            .for("update")
            .limit(1);
          if (
            !bridge ||
            (bridge.status !== "pending" && bridge.status !== "accepted")
          )
            throw errors.BAD_REQUEST({ message: "Invitation is closed." });
        }
        const [existing] = await tx
          .select({
            id: participants.id,
            partnerId: participants.representedOrganizationId,
          })
          .from(participants)
          .where(
            and(
              eq(participants.projectId, partnership.projectId),
              eq(participants.userId, context.user.id),
            ),
          )
          .limit(1);
        if (existing && existing.partnerId !== partnership.partnerId)
          throw errors.BAD_REQUEST({
            message:
              "You already joined this Project through another Partner Organization.",
          });
        await tx
          .insert(profiles)
          .values({ userId: context.user.id, fullName: input.profile.fullName })
          .onConflictDoUpdate({
            target: profiles.userId,
            set: { fullName: input.profile.fullName, updatedAt: new Date() },
          });
        await tx
          .insert(acceptances)
          .values({
            userId: context.user.id,
            version: version.id,
            contentHash: version.contentHash,
            answers: JSON.stringify(input.agreement),
          })
          .onConflictDoNothing();
        let participationId = existing?.id;
        if (!participationId) {
          const [created] = await tx
            .insert(participants)
            .values({
              projectId: partnership.projectId,
              representedOrganizationId: partnership.partnerId,
              userId: context.user.id,
              displayName: input.profile.fullName,
              email: context.user.email.trim().toLowerCase(),
            })
            .onConflictDoNothing()
            .returning({ id: participants.id });
          if (!created)
            throw errors.BAD_REQUEST({
              message: "You already joined this Project.",
            });
          participationId = created.id;
        }
        if (bridgeId) {
          await tx
            .update(bridges)
            .set({ status: "accepted", acceptedAt: new Date() })
            .where(eq(bridges.invitationId, bridgeId));
          // Existing host members do not call BA accept; disable the unused native
          // invitation so its public endpoint cannot create a duplicate membership.
          await tx
            .update(invitation)
            .set({ status: "canceled" })
            .where(
              and(eq(invitation.id, bridgeId), eq(invitation.status, "pending")),
            );
        }
        return { participationId };
      });
    });

  const listMyProjects = authorized
    .output(
      z.array(
        z.object({
          participationId: z.string(),
          projectId: z.string(),
          projectName: z.string(),
        }),
      ),
    )
    .handler(async ({ context, errors }) => {
      const version = requirePublishedAgreement(errors);
      const [profile] = await db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(eq(profiles.userId, context.user.id))
        .limit(1);
      const [latest] = await db
        .select({
          version: acceptances.version,
          contentHash: acceptances.contentHash,
        })
        .from(acceptances)
        .where(eq(acceptances.userId, context.user.id))
        .orderBy(desc(acceptances.acceptedAt), desc(acceptances.id))
        .limit(1);
      if (
        !profile ||
        latest?.version !== version.id ||
        latest.contentHash !== version.contentHash
      )
        throw errors.FORBIDDEN({
          message:
            "Complete your profile and accept the current agreement before accessing Projects.",
        });
      return db
        .select({
          participationId: participants.id,
          projectId: projects.id,
          projectName: projects.name,
        })
        .from(participants)
        .innerJoin(projects, eq(projects.id, participants.projectId))
        .innerJoin(
          member,
          and(
            eq(member.organizationId, projects.organizationId),
            eq(member.userId, context.user.id),
          ),
        )
        .where(
          and(
            eq(participants.userId, context.user.id),
            isNull(participants.mergedIntoParticipantId),
            sql`(',' || ${member.role} || ',') ~ ',(participant|owner|admin),'`,
          ),
        );
    });
  return {
    acceptAgreement,
    saveProfile,
    createRegistrationLink,
    setRegistrationLinkOpen,
    issueInvitation,
    setInvitationOpen,
    join,
    listMyProjects,
  };
}

export const participantOnboarding = createParticipantOnboardingProcedures();
