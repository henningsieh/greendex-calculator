import "server-only";
import {
  canCreateOrganization,
  hasOrganizationRole,
  ORGANIZATION_ROLES,
} from "@greendex/auth";
import { ORPCError } from "@orpc/server";

import type {
  OnboardingFacts,
  OnboardingInput,
  ValidatedOnboardingEntry,
} from "@/features/authentication/onboarding-decision";
import { readOrganizationMemberships } from "@/features/organizations/procedures/memberships";
import { readStaffInvitation } from "@/features/organizations/procedures/staff-invites";
import {
  isStaffOrganizationRole,
  resolveStaffOrganizationContext,
} from "@/features/organizations/staff-eligibility";
import {
  readSetupBindingEligibility,
  readSetupLinkEligibility,
} from "@/features/projects/procedures/setup-links";
import { auth, costTrackerAuthFlags } from "@/lib/auth";
import { getSafeErrorSituation } from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";
import { safeSignInReturnTo } from "@/lib/session";

type ProcedureErrors = Parameters<typeof readStaffInvitation>[2];

function classifyEntry(
  returnTo: string | undefined,
): ValidatedOnboardingEntry["kind"] {
  if (
    returnTo === "/accept-invitation" ||
    returnTo?.startsWith("/accept-invitation/")
  )
    return "organization-invitation";
  if (returnTo === "/setup-links" || returnTo?.startsWith("/setup-links/"))
    return "partner-setup";
  return "direct";
}

export async function loadOnboardingFacts(
  headers: Headers,
  input: OnboardingInput,
  errors: ProcedureErrors,
): Promise<OnboardingFacts> {
  const returnTo = safeSignInReturnTo(input.returnTo);
  const entryContext = classifyEntry(input.returnTo);
  const session = await auth.api.getSession({ headers });
  if (!session) return { account: "signed-out", entryContext, returnTo };
  if (!session.user.emailVerified)
    return { account: "unverified", entryContext, email: session.user.email };

  const [memberships, canCreate] = await Promise.all([
    readOrganizationMemberships(session.user.id),
    canCreateOrganization(session.user.id, costTrackerAuthFlags),
  ]);
  const organizationContext = resolveStaffOrganizationContext({
    memberships,
    activeOrganizationId: session.session.activeOrganizationId ?? null,
  });
  const situations = createSituationErrors(errors);
  let entry: ValidatedOnboardingEntry;
  if (entryContext === "direct") entry = { kind: "direct" };
  else {
    try {
      if (entryContext === "organization-invitation") {
        if (!returnTo) throw situations.staffInvitationNotFound();
        const invitationId = returnTo.slice("/accept-invitation/".length);
        const invitation = await readStaffInvitation(
          invitationId,
          session.user.email,
          errors,
          true,
        );
        if (invitation.status === "accepted") {
          const membership = memberships.find(
            ({ id, role }) =>
              id === invitation.organizationId && isStaffOrganizationRole(role),
          );
          if (!membership) throw situations.staffInvitationClosed();
          entry = {
            kind: entryContext,
            status: "complete",
            organization: { id: membership.id, name: membership.name },
          };
        } else entry = { kind: entryContext, status: "pending", invitationId };
      } else {
        if (!returnTo) throw situations.setupLinkNotFound();
        const url = new URL(returnTo, "https://onboarding.invalid");
        const secret = url.searchParams.get("secret");
        if (!secret) throw situations.setupLinkNotFound();
        const setupInput = {
          id: url.pathname.slice("/setup-links/".length),
          secret,
        };
        const eligibility = await readSetupLinkEligibility(
          setupInput,
          session.user,
          situations,
        );
        const owned = memberships
          .filter(({ role }) =>
            hasOrganizationRole(role, ORGANIZATION_ROLES.OrganizationOwner),
          )
          .map(({ id, name }) => ({ id, name }));
        if (eligibility.status === "redeemed") {
          const organization = owned.find(
            ({ id }) => id === eligibility.organizationId,
          );
          if (!organization) throw situations.organizationOwnerRequired();
          if (
            input.setupRecovery &&
            input.setupRecovery.phase !== "creating" &&
            input.setupRecovery.organizationId !== organization.id
          )
            throw situations.setupLinkUsed();
          entry = {
            kind: entryContext,
            status: "complete",
            organization,
            destination: `/projects/${encodeURIComponent(eligibility.projectId)}`,
          };
        } else if (
          input.setupRecovery &&
          input.setupRecovery.phase !== "creating"
        ) {
          const organizationId = input.setupRecovery.organizationId;
          await readSetupBindingEligibility(
            { ...setupInput, organizationId },
            session.user,
            situations,
          );
          entry = { kind: entryContext, status: "bind", organizationId };
        } else {
          const allowCreation = canCreate && !input.setupRecovery;
          if (!allowCreation && owned.length === 0)
            throw situations.organizationOwnerRequired();
          entry = {
            kind: entryContext,
            status: "choose",
            organizations: owned,
            canCreate: allowCreation,
          };
        }
      }
    } catch (error) {
      const situation =
        error instanceof ORPCError ? getSafeErrorSituation(error) : undefined;
      if (
        !situation ||
        ["INTERNAL_SERVER_ERROR", "SERVICE_UNAVAILABLE"].includes(situation.code)
      )
        throw error;
      entry = {
        kind: entryContext,
        status: "recovery",
        reason: situation.reason,
      };
    }
  }
  return { account: "verified", organizationContext, canCreate, entry };
}
