"use client";

import { useTranslations } from "@greendex/i18n/client";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import type { ClaimStatus } from "@/features/claims/claim-lifecycle";

const variants = {
  in_preparation: "secondary",
  submitted: "status-attention",
  correction_requested: "status-correction",
  approved: "status-success",
  rejected: "status-destructive-solid",
  paid: "status-success-solid",
} satisfies Record<ClaimStatus, ComponentProps<typeof Badge>["variant"]>;

export function ClaimStatusBadge({ status }: { status: ClaimStatus | null }) {
  const t = useTranslations("claims");
  return (
    <Badge
      data-testid="claim-status"
      data-status={status ?? "none"}
      data-claim-status={status ?? "none"}
      variant={status ? variants[status] : "secondary"}
    >
      {status === null
        ? t("workspace.noClaim")
        : status === "approved"
          ? t("review.status.approved")
          : t(`workspace.status.${status}`)}
    </Badge>
  );
}
