import { ORPCError } from "@orpc/client";

import { situationCatalog } from "@/lib/orpc/error-contract";

const refusalCodes: readonly string[] = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
];

/**
 * Errors that mean "this viewer may not see this", not "the data failed".
 *
 * The protected shell renders its children behind recovery screens (select an
 * Organization, verify the email, accept the invitation) and keeps them
 * mounted-but-hidden. Presentation code must therefore degrade on these
 * refusals instead of throwing, or the hidden child replaces the recovery
 * screen with an error page.
 */
export function isPresentationRefusal(error: unknown): boolean {
  if (!(error instanceof ORPCError)) return false;
  if (refusalCodes.includes(error.code)) return true;
  const reason = (error.data as { reason?: string } | undefined)?.reason;
  return (
    reason === situationCatalog.selectOrganization.reason ||
    reason === situationCatalog.notMember.reason
  );
}
