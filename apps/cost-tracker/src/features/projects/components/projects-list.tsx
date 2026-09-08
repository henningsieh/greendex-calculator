"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDaysIcon, FolderKanbanIcon, MapPinIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { orpcQuery } from "@/lib/orpc/orpc";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function ProjectsList() {
  const { data: projects } = useSuspenseQuery(
    orpcQuery.projects.list.queryOptions(),
  );

  if (projects.length === 0) {
    return (
      <Empty className="mt-10 border-y">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderKanbanIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            <h2>No active Projects</h2>
          </EmptyTitle>
          <EmptyDescription>
            Projects for the selected Organization will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="mt-10 divide-y border-y">
      {projects.map((project) => (
        <li
          className="grid gap-5 py-6 md:grid-cols-[1fr_auto] md:items-center"
          key={project.id}
        >
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-xl font-semibold">
                {project.name}
              </h2>
              <Badge
                variant={project.costSubmissionWindowOpen ? "default" : "outline"}
              >
                Cost window {project.costSubmissionWindowOpen ? "open" : "closed"}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <MapPinIcon aria-hidden="true" className="size-4" />
                {project.location}
              </span>
              <span className="flex items-center gap-2">
                <CalendarDaysIcon aria-hidden="true" className="size-4" />
                {dateFormatter.format(project.startDate)}–
                {dateFormatter.format(project.endDate)}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {project.partnerOrganizationCount}{" "}
            {project.partnerOrganizationCount === 1
              ? "Partner Organization"
              : "Partner Organizations"}
          </p>
        </li>
      ))}
    </ul>
  );
}
