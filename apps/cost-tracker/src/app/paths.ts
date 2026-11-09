import type { AppHref } from "@/app/routes";

/**
 * A destination the server already resolved and validated: an onboarding
 * decision, an invitation target, or a setup-link continuation.
 *
 * These arrive through the procedure contract as plain strings, so the cast
 * belongs here rather than at every caller. Callers that build a path from an
 * id use the builders above instead.
 */
export function destinationHref(destination: string): AppHref {
  return destination as AppHref;
}

/**
 * Builders for the dynamic Project and Project Partnership paths.
 *
 * A template literal widens to `string` once an id is interpolated, so every
 * caller used to repeat the same cast. The cast lives here instead: callers
 * pass a raw id, and encoding plus the typed-href union stay in one place.
 */
export function projectPath(projectId: string): AppHref {
  return `/projects/${encodeURIComponent(projectId)}` as AppHref;
}

export function projectParticipantsPath(projectId: string): AppHref {
  return `${projectPath(projectId)}/participants` as AppHref;
}

export function partnershipPath(partnershipId: string): AppHref {
  return `/partnerships/${encodeURIComponent(partnershipId)}` as AppHref;
}

export function partnershipParticipantsPath(partnershipId: string): AppHref {
  return `${partnershipPath(partnershipId)}/participants` as AppHref;
}

export function participationPath(
  partnershipId: string,
  participationId: string,
): AppHref {
  return `${partnershipParticipantsPath(partnershipId)}/${encodeURIComponent(
    participationId,
  )}` as AppHref;
}

export function partnershipClaimPath(partnershipId: string): AppHref {
  return `${partnershipPath(partnershipId)}/claim` as AppHref;
}

export function partnershipClaimReviewPath(partnershipId: string): AppHref {
  return `${partnershipPath(partnershipId)}/claim/review` as AppHref;
}
