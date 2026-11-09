import type { AppHref } from "@/app/routes";

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
