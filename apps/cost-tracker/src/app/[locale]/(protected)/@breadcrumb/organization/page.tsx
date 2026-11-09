import { BreadcrumbSlot } from "@/features/breadcrumbs/components/breadcrumb-slot";

// Request-time chrome: the breadcrumb resolves at request time.
export const instant = false;

export default function OrganizationBreadcrumb() {
  return <BreadcrumbSlot current="nav.organization" />;
}
