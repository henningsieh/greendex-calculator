import { db } from "@greendex/database";
import {
  claimsTable as claims,
  claimStatusEnum,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";

import {
  createSituationErrors,
  type ScopeErrorConstructors,
} from "@/lib/orpc/errors";

type ClaimStatus = (typeof claimStatusEnum.enumValues)[number];

type ClaimScopeTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface ClaimScope {
  projectId: string;
  partnershipId: string;
}

type ClaimScopeErrors = ScopeErrorConstructors;

/** A correction request reopens all Partner-side edits, including the selected payout account. */
export function isPartnerEditLocked(status: ClaimStatus): boolean {
  return status !== "editable" && status !== "correction_requested";
}

/**
 * Locks Project → Partnership → Claim in one shared order so concurrent
 * decisions, payments, and payout changes cannot race each other.
 * Returns the locked rows; claim is undefined when none exists yet.
 */
export async function lockClaimScope(
  tx: ClaimScopeTransaction,
  scope: ClaimScope,
  errors: ClaimScopeErrors,
) {
  const [project] = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, scope.projectId), eq(projects.archived, false)))
    .for("update")
    .limit(1);
  const [partnership] = await tx
    .select({ id: partnerships.id })
    .from(partnerships)
    .where(
      and(
        eq(partnerships.id, scope.partnershipId),
        eq(partnerships.projectId, scope.projectId),
      ),
    )
    .for("update")
    .limit(1);
  if (!project || !partnership)
    throw createSituationErrors(errors).partnershipNotFound();
  const [claim] = await tx
    .select({
      id: claims.id,
      status: claims.status,
      approvedAmountEur: claims.approvedAmountEur,
    })
    .from(claims)
    .where(eq(claims.partnershipId, scope.partnershipId))
    .for("update")
    .limit(1);
  return { project, partnership, claim };
}
