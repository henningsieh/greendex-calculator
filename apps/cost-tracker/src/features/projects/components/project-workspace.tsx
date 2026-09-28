"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Building2Icon, CalendarDaysIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectListReturnDestination } from "@/features/projects/project-list-query-options";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

type ClaimStatus = Extract<
  Outputs["projects"]["get"],
  { relationship: "hosted" }
>["partnerOrganizations"][number]["claimStatus"];

const readinessLabels: Record<NonNullable<ClaimStatus>, string> = {
  editable: "Active Claim · editable",
  submitted: "Submitted",
  correction_requested: "Correction requested",
  approved: "Approved · unpaid",
  rejected: "Rejected",
  paid: "Paid",
};

function ClaimReadiness({ status }: { status: ClaimStatus }) {
  return (
    <Badge variant="secondary">
      {status ? readinessLabels[status] : "No Claim"}
    </Badge>
  );
}

export function ProjectWorkspace({
  projectId,
  returnTo,
}: {
  projectId: string;
  returnTo?: string;
}) {
  const queryClient = useQueryClient();
  const [completing, setCompleting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const { data: project } = useSuspenseQuery(
    orpcQuery.projects.get.queryOptions({
      input: { projectId },
      meta: { costTrackerORPC: true },
    }),
  );

  const canComplete =
    project.relationship === "hosted" &&
    !project.archived &&
    !project.completedAt &&
    project.partnerOrganizations.every(
      ({ claimStatus }) => claimStatus === "paid" || claimStatus === "rejected",
    );

  async function completeProject() {
    if (completing) return;
    setCompleting(true);
    setFeedback("");
    try {
      await orpc.projects.complete({ projectId });
      setFeedback("Project completed.");
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.get.queryOptions({ input: { projectId } })
          .queryKey,
      });
    } catch (error) {
      setFeedback(getORPCRequestErrorMessage(error).text);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Link
          className={buttonVariants({ variant: "ghost" })}
          href={getProjectListReturnDestination(returnTo)}
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
          {project.completedAt && <Badge variant="secondary">Completed</Badge>}
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
        {project.completedAt && (
          <p className="text-sm">
            Completed {dateTimeFormatter.format(project.completedAt)} by{" "}
            {project.completedByUserId}
          </p>
        )}
        {canComplete && (
          <Button disabled={completing} onClick={completeProject} type="button">
            {completing ? "Completing…" : "Complete Project"}
          </Button>
        )}
        {feedback && <output className="text-sm">{feedback}</output>}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <CalendarDaysIcon
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
            <span className="text-sm">
              {dateFormatter.format(project.startDate)} –{" "}
              {dateFormatter.format(project.endDate)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <MapPinIcon
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
            <span className="text-sm">
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
                    <span className="flex flex-wrap items-center gap-3">
                      <ClaimReadiness status={partner.claimStatus} />
                      <span className="text-sm text-muted-foreground">
                        Assigned {dateTimeFormatter.format(partner.assignedAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <Link
                className={buttonVariants({ variant: "outline" })}
                href="/claims/review"
              >
                Review submitted Claims
              </Link>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href="/partner-organizations"
              >
                Manage Project Partnerships
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Project Partnership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Claim readiness:</span>{" "}
              <ClaimReadiness status={project.partnership.claimStatus} />
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Hosting Organization:</span>{" "}
              {project.hostingOrganization.name}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Assigned:</span>{" "}
              {dateTimeFormatter.format(project.partnership.assignedAt)}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Assignment updated:</span>{" "}
              {dateTimeFormatter.format(project.partnership.updatedAt)}
            </p>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/partnerships/${encodeURIComponent(project.partnership.id)}/participants`}
            >
              Coordinate Participants
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/partnerships/${encodeURIComponent(project.partnership.id)}/claim`}
            >
              Open Claim workspace
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
