"use client";

import { useTranslations } from "@greendex/i18n/client";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import type {
  projectStatus,
  ProjectState,
} from "@/features/projects/project-lifecycle";

type ProjectListStatus = ReturnType<typeof projectStatus>;
const variants = {
  open: "status-attention",
  ready: "status-success",
  archived: "secondary",
} satisfies Record<ProjectListStatus, ComponentProps<typeof Badge>["variant"]>;

export function ProjectStatusBadge({ status }: { status: ProjectListStatus }) {
  const t = useTranslations("projects");
  return (
    <Badge
      variant={variants[status]}
      data-status={status}
      data-testid="project-status"
    >
      {t(`list.status.${status}`)}
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
