"use client";

import { useTranslations } from "@greendex/i18n/client";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import type {
  projectSettlement,
  ProjectState,
} from "@/features/projects/project-lifecycle";

type Settlement = ReturnType<typeof projectSettlement>;
const variants = {
  open: "status-attention",
  ready: "status-success",
  archived: "secondary",
} satisfies Record<Settlement, ComponentProps<typeof Badge>["variant"]>;

export function ProjectSettlementBadge({ status }: { status: Settlement }) {
  const t = useTranslations("projects");
  return (
    <Badge
      variant={variants[status]}
      data-settlement={status}
      data-testid="project-workspace-settlement"
    >
      {status === "archived"
        ? t("workspace.archived")
        : t(`list.settlement.${status}`)}
    </Badge>
  );
}

export function ProjectArchiveBadge({ status }: { status: ProjectState }) {
  const t = useTranslations("projects");
  return (
    <Badge
      variant={status === "archived" ? variants.archived : "outline"}
      data-project-archive-status={status}
      data-testid={
        status === "archived"
          ? "project-archived-status"
          : "project-active-status"
      }
    >
      {t(`workspace.${status}`)}
    </Badge>
  );
}
