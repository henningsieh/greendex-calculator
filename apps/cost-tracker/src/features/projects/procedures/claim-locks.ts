import { db } from "@greendex/database";
import {
  claimsTable as claims,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";

import {
  createSituationErrors,
  type ScopeErrorConstructors,
} from "@/lib/orpc/errors";

type ClaimScopeTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface ClaimScope {
  projectId: string;
  partnershipId: string;
  /**
   * Partner Organization that must own the Partnership. Partner-side writes pass
   * it so the locked row is the one they are authorized for; Hosting-side
   * decisions lock the Partnership of their hosted Project as found.
   */
  partnerOrganizationId?: string | null;
}

/**
 * The rows one write must hold, derived from the invariants that write protects
 * (ADR-0017). Every coverage is a suffix of the one order
 * Project → Partnership → Claim, so two writers can never hold the row the
 * other waits for:
 *
 * - `claim`: lifecycle state and the Claim-owned data every edit revalidates
 *   against it — Travel Cost Entries, Cost Allocations, Proof Documents.
 * - `partnership`: adds the Partnership's own Claim: its first save and its
 *   Payout Account selection.
 * - `project`: adds the Project's frozen funding rules and every Hosting
 *   decision about the Claim.
 */
export type ClaimLockCoverage = "claim" | "partnership" | "project";

const coveredRows = {
  claim: { project: false, partnership: false },
  partnership: { project: false, partnership: true },
  project: { project: true, partnership: true },
} as const;

const lockedClaim = {
  id: claims.id,
  partnershipId: claims.partnershipId,
  status: claims.status,
  approvedAmountEur: claims.approvedAmountEur,
};

/**
 * Locks the requested coverage in the one order Project → Partnership → Claim so
 * concurrent edits, decisions, payments and payout changes cannot race each
 * other. Returns the locked rows; `claim` is undefined when none exists yet.
 * This is the only way those rows are locked.
 */
export async function lockClaimScope(
  tx: ClaimScopeTransaction,
  scope: ClaimScope,
  errors: ScopeErrorConstructors,
  coverage: ClaimLockCoverage,
) {
  const rows = coveredRows[coverage];
  const [project] = rows.project
    ? await tx
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(eq(projects.id, scope.projectId), eq(projects.archived, false)),
        )
        .for("update")
        .limit(1)
    : [];
  const [partnership] = rows.partnership
    ? await tx
        .select({ id: partnerships.id })
        .from(partnerships)
        .where(
          and(
            eq(partnerships.id, scope.partnershipId),
            eq(partnerships.projectId, scope.projectId),
            scope.partnerOrganizationId
              ? eq(partnerships.organizationId, scope.partnerOrganizationId)
              : undefined,
          ),
        )
        .for("update")
        .limit(1)
    : [];
  if ((rows.project && !project) || (rows.partnership && !partnership))
    throw createSituationErrors(errors).partnershipNotFound();
  const [claim] = await tx
    .select(lockedClaim)
    .from(claims)
    .where(eq(claims.partnershipId, scope.partnershipId))
    .for("update")
    .limit(1);
  return { project, partnership, claim };
}
