import type { ProjectNavigationContext } from "@/features/breadcrumbs/breadcrumb-routes";

export function partnershipNavigation(
  projectId: string,
  partnershipId: string,
  organizations: { hostOrganizationId: string; partnerOrganizationId: string },
  activeOrganizationId: string | null | undefined,
): ProjectNavigationContext | undefined {
  if (activeOrganizationId === organizations.hostOrganizationId)
    return { projectId, partnershipId, relationship: "hosted" };
  if (activeOrganizationId === organizations.partnerOrganizationId)
    return { projectId, partnershipId, relationship: "partner" };
}
