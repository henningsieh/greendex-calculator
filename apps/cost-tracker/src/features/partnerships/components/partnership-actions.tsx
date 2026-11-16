"use client";

import { useSuspenseQueries } from "@tanstack/react-query";

import { AssignOrganizationDialog } from "@/features/partnerships/components/project-partnership-assigner";
import { CreateSetupLinkDialog } from "@/features/partnerships/components/setup-link";
import { orpcQuery } from "@/lib/orpc/orpc";

export function PartnershipActions({
  projectId,
  organizationId,
}: {
  /** Preselects the Hosted Project (and locks it) for both dialogs. */
  projectId?: string;
  /** Preselects the Partner Organization (and locks it) for assignment. */
  organizationId?: string;
} = {}) {
  const [projects, organizations] = useSuspenseQueries({
    queries: [
      orpcQuery.projects.listHostedOptions.queryOptions({
        meta: { costTrackerORPC: true },
      }),
      orpcQuery.organizations.listOptions.queryOptions({
        meta: { costTrackerORPC: true },
      }),
    ],
  });

  return (
    <div className="flex flex-col gap-2">
      <CreateSetupLinkDialog projectId={projectId} projects={projects.data} />
      <AssignOrganizationDialog
        organizationId={organizationId}
        projectId={projectId}
        projects={projects.data}
        organizations={organizations.data}
      />
    </div>
  );
}
