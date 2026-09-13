"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Building2Icon, CalendarDaysIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectCollectionReturnDestination } from "@/features/projects/collection-state";
import { orpcQuery } from "@/lib/orpc/orpc";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function ProjectWorkspace({
  projectId,
  returnTo,
}: {
  projectId: string;
  returnTo?: string;
}) {
  const { data: project } = useSuspenseQuery(
    orpcQuery.projects.detail.queryOptions({
      input: { projectId },
      meta: { costTrackerORPC: true },
    }),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Link
          className={buttonVariants({ variant: "ghost" })}
          href={getProjectCollectionReturnDestination(returnTo)}
        >
          Back to Projects
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-primary">
            {project.relationship === "hosted"
              ? "Hosted Project"
              : "Partner Project"}
          </p>
          {project.archived && <Badge variant="secondary">Archived</Badge>}
        </div>
        <h1 className="font-heading text-4xl font-semibold tracking-tight">
          {project.name}
        </h1>
        <Badge
          variant={project.costSubmissionWindowOpen ? "default" : "secondary"}
        >
          Cost Submission Window{" "}
          {project.costSubmissionWindowOpen ? "open" : "closed"}
        </Badge>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3 text-sm">
            <CalendarDaysIcon
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
            <span>
              {dateFormatter.format(project.startDate)} –{" "}
              {dateFormatter.format(project.endDate)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3 text-sm">
            <MapPinIcon
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
            <span>
              {[project.location, project.country].filter(Boolean).join(", ")}
            </span>
          </CardContent>
        </Card>
      </div>

      {project.relationship === "hosted" ? (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Partner Organizations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {project.partnerOrganizations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Partner Organizations are assigned.
              </p>
            ) : (
              <ul className="divide-y">
                {project.partnerOrganizations.map((partner) => (
                  <li
                    className="flex items-center justify-between gap-4 py-4"
                    key={partner.id}
                  >
                    <span className="flex items-center gap-3 font-medium">
                      <Building2Icon
                        aria-hidden="true"
                        className="size-5 text-muted-foreground"
                      />
                      {partner.organizationName}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Assigned {dateTimeFormatter.format(partner.assignedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/partner-organizations"
            >
              Manage Project Partnerships
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Project Partnership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Hosting Organization:</span>{" "}
              {project.hostingOrganization.name}
            </p>
            <p>
              <span className="text-muted-foreground">Assigned:</span>{" "}
              {dateTimeFormatter.format(project.partnership.assignedAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Assignment updated:</span>{" "}
              {dateTimeFormatter.format(project.partnership.updatedAt)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
