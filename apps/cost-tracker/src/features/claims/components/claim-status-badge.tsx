"use client";

import { useTranslations } from "@greendex/i18n/client";

import { Badge } from "@/components/ui/badge";
import type { ClaimStatus } from "@/features/claims/claim-lifecycle";
import { cn } from "@/lib/utils";

const dotClasses = {
  approved: "bg-success",
  correction_requested: "bg-destructive",
  in_preparation: "bg-muted-foreground",
  paid: "bg-success",
  rejected: "bg-destructive",
  submitted: "bg-brand",
} satisfies Record<ClaimStatus, string>;

export function ClaimStatusBadge({ status }: { status: ClaimStatus | null }) {
  const t = useTranslations("claims");
  return (
    <Badge
      data-testid="claim-status"
      data-status={status ?? "none"}
      data-claim-status={status ?? "none"}
      variant="claim-state"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          status ? dotClasses[status] : "bg-muted-foreground",
        )}
      />
      {status === null
        ? t("workspace.noClaim")
        : status === "approved"
          ? t("review.status.approved")
          : t(`workspace.status.${status}`)}
    </Badge>
  );
}
