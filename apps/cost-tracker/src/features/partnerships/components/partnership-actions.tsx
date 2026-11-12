"use client";

import { useSuspenseQueries } from "@tanstack/react-query";

import { AssignOrganizationDialog } from "@/features/partnerships/components/project-partnership-assigner";
import { CreateSetupLinkDialog } from "@/features/partnerships/components/setup-link";
import { orpcQuery } from "@/lib/orpc/orpc";

export function PartnershipActions() {
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
    <div className="flex gap-2">
      <CreateSetupLinkDialog projects={projects.data} />
      <AssignOrganizationDialog
        projects={projects.data}
        organizations={organizations.data}
      />
    </div>
  );
}
