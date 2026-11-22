import { BreadcrumbSlot } from "@/features/breadcrumbs/components/breadcrumb-slot";

// Request-time chrome: the breadcrumb resolves at request time.
export const instant = false;

export default function ClaimReviewQueueBreadcrumb() {
  return <BreadcrumbSlot current="nav.claimReview" />;
}
