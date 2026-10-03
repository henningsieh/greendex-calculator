import "server-only";
import { db } from "@greendex/database";
import {
  member,
  organization,
  participantAgreementAcceptancesTable as acceptances,
  participantProfilesTable as profiles,
  projectParticipantsTable as participants,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { type RequirePublishedAgreement } from "@/features/authentication/procedures/shared";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

export function buildListMyProjects(
  requirePublishedAgreement: RequirePublishedAgreement,
) {
  const representedOrganization = alias(organization, "represented_organization");
  const hostingOrganization = alias(organization, "hosting_organization");
  const listMyProjects = authorized
    .output(
      z.array(
        z.object({
          participationId: z.string(),
          projectId: z.string(),
          projectName: z.string(),
          representedOrganizationName: z.string(),
          hostingOrganizationName: z.string(),
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
      if (!profile) throw createSituationErrors(errors).incompleteProfile();
      if (
        latest?.version !== version.id ||
        latest.contentHash !== version.contentHash
      )
        throw createSituationErrors(errors).agreementRequired();
      return db
        .select({
          participationId: participants.id,
          projectId: projects.id,
          projectName: projects.name,
          representedOrganizationName: representedOrganization.name,
          hostingOrganizationName: hostingOrganization.name,
        })
        .from(participants)
        .innerJoin(projects, eq(projects.id, participants.projectId))
        .innerJoin(
          representedOrganization,
          eq(representedOrganization.id, participants.representedOrganizationId),
        )
        .innerJoin(
          hostingOrganization,
          eq(hostingOrganization.id, projects.organizationId),
        )
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
  return listMyProjects;
}
