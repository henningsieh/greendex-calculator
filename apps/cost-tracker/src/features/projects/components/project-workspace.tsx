"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Building2Icon, CalendarDaysIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ClaimStatus,
  canCompleteProject,
} from "@/features/claims/claim-lifecycle";
import { getProjectListReturnDestination } from "@/features/projects/list-query-options";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const readinessLabels: Record<ClaimStatus, string> = {
  editable: "Active Claim · editable",
  submitted: "Submitted",
  correction_requested: "Correction requested",
  approved: "Approved · unpaid",
  rejected: "Rejected",
  paid: "Paid",
};

function ClaimReadiness({ status }: { status: ClaimStatus | null }) {
  return (
    <Badge data-claim-status={status ?? "none"} variant="secondary">
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
  const t = useTranslations("projects.workspace");
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
    canCompleteProject(
      project.partnerOrganizations.map(({ claimStatus }) => claimStatus),
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
    <div
      className="space-y-8"
      data-project-id={project.id}
      data-testid="project-workspace"
    >
      <header className="space-y-4">
        <Link
          className={buttonVariants({ variant: "ghost" })}
          href={getProjectListReturnDestination(returnTo)}
          data-testid="back-to-projects"
        >
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <p
            className="text-sm font-medium text-primary"
            data-relationship={project.relationship}
          >
            {project.relationship === "hosted"
              ? t("hostedProject")
              : t("partnerProject")}
          </p>
          {project.archived && <Badge variant="secondary">{t("archived")}</Badge>}
          {project.completedAt && (
            <Badge data-testid="project-completed" variant="secondary">
              {t("completed")}
            </Badge>
          )}
        </div>
        <h1 className="font-heading text-4xl font-semibold tracking-tight">
          {project.name}
        </h1>
        <Badge
          variant={project.costSubmissionWindowOpen ? "default" : "secondary"}
        >
          {t("submissionWindow")}{" "}
          {project.costSubmissionWindowOpen ? "open" : "closed"}
        </Badge>
        {project.completedAt && (
          <p
            className="text-sm"
            data-completed-at={project.completedAt.toISOString()}
            data-completed-by-user-id={project.completedByUserId}
          >
            {t("completed")} {dateTimeFormatter.format(project.completedAt)}{" "}
            {t("by")} {project.completedByUserId}
          </p>
        )}
        {canComplete && (
          <Button
            disabled={completing}
            onClick={completeProject}
            data-testid="complete-project"
            type="button"
          >
            {completing ? "Completing…" : "Complete Project"}
          </Button>
        )}
        {feedback && <output className="text-sm">{feedback}</output>}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("schedule")}</CardTitle>
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
            <CardTitle>{t("location")}</CardTitle>
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
        <Card data-testid="assigned-partner-organizations">
          <CardHeader>
            <CardTitle>{t("assignedPartners")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {project.partnerOrganizations.length === 0 ? (
              <p
                className="text-sm text-muted-foreground"
                data-testid="assigned-partnerships-empty"
              >
                {t("noPartners")}
              </p>
            ) : (
              <ul className="divide-y">
                {project.partnerOrganizations.map((partner) => (
                  <li
                    className="flex items-center justify-between gap-4 py-4"
                    data-organization-id={partner.organizationId}
                    data-partnership-id={partner.id}
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
                        {t("assigned")}{" "}
                        {dateTimeFormatter.format(partner.assignedAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={`/projects/${encodeURIComponent(project.id)}/participants`}
                data-testid="hosted-participants"
              >
                {t("participantView")}
              </Link>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href="/claims/review"
              >
                {t("reviewClaims")}
              </Link>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href="/partner-organizations"
                data-testid="manage-project-partnerships"
              >
                {t("managePartnerships")}
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("partnership")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="text-muted-foreground">{t("claimReadiness")}</span>{" "}
              <ClaimReadiness status={project.partnership.claimStatus} />
            </p>
            <p
              className="text-sm"
              data-organization-id={project.hostingOrganization.id}
              data-testid="hosting-organization"
            >
              <span className="text-muted-foreground">
                {t("hostingOrganization")}
              </span>{" "}
              {project.hostingOrganization.name}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">{t("assignedLabel")}</span>{" "}
              {dateTimeFormatter.format(project.partnership.assignedAt)}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">
                {t("assignmentUpdated")}
              </span>{" "}
              {dateTimeFormatter.format(project.partnership.updatedAt)}
            </p>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/partnerships/${encodeURIComponent(project.partnership.id)}/participants`}
              data-testid="coordinate-participants"
            >
              {t("coordinateParticipants")}
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/partnerships/${encodeURIComponent(project.partnership.id)}/claim`}
              data-testid="open-claim-workspace"
            >
              {t("openClaim")}
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
