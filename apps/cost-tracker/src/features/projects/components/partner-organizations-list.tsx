"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Building2Icon, FolderKanbanIcon } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { orpcQuery } from "@/lib/orpc/orpc";

export function PartnerOrganizationsList() {
  const { data: partners } = useSuspenseQuery(
    orpcQuery.partnerOrganizations.list.queryOptions(),
  );

  if (partners.length === 0) {
    return (
      <Empty className="mt-10 border-y">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2Icon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            <h2>No Partner Organizations</h2>
          </EmptyTitle>
          <EmptyDescription>
            Project-specific Partner Organizations will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
      {partners.map((partner) => (
        <li className="bg-card p-6" key={partner.id}>
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Building2Icon aria-hidden="true" className="size-4" />
          </span>
          <h2 className="mt-7 font-heading text-xl font-semibold">
            {partner.name}
          </h2>
          <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
            <FolderKanbanIcon
              aria-hidden="true"
              className="mt-1 size-4 shrink-0"
            />
            {partner.projectNames.join(", ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
