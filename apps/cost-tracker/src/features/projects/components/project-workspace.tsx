"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useDateFormat } from "@greendex/i18n/datetime/client";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import * as Flags from "country-flag-icons/react/3x2";
import { CalendarDaysIcon, CheckIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import {
  partnershipClaimPath,
  partnershipParticipantsPath,
  projectParticipantsPath,
} from "@/app/paths";
import {
  StatCell,
  StatDetail,
  StatGrid,
  StatLabel,
  StatNumber,
} from "@/components/brand/stat-grid";
import { EntityIcon } from "@/components/entity-icon";
import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import ProtectedPageHeader from "@/components/protected-page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ClaimStatus,
  canCompleteProject,
  isClaimAwaitingReview,
} from "@/features/claims/claim-lifecycle";
import { StatsSkeletonGrid } from "@/features/projects/components/project-loading-states";
import { Link } from "@/lib/i18n/routing";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

function ClaimReadiness({ status }: { status: ClaimStatus | null }) {
  const t = useTranslations("projects.workspace");
  if (!status) {
    return (
      <Badge data-claim-status="none" variant="secondary">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-current opacity-60"
        />
        {t("noClaim")}
      </Badge>
    );
  }
  const labels: Record<ClaimStatus, string> = {
    editable: t("claimStatus.editable"),
    submitted: t("claimStatus.submitted"),
    correction_requested: t("claimStatus.correctionRequested"),
    approved: t("claimStatus.approved"),
    rejected: t("claimStatus.rejected"),
    paid: t("claimStatus.paid"),
  };
  return (
    <Badge
      data-claim-status={status}
      variant={
        status === "correction_requested" || status === "rejected"
          ? "destructive"
          : status === "submitted" || status === "approved"
            ? "status-pass"
            : "secondary"
      }
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {labels[status]}
    </Badge>
  );
}

function CountryFlag({ country }: { country: string }) {
  const Flag = Flags[country as keyof typeof Flags] as
    | React.ComponentType<{ className?: string }>
    | undefined;
  if (!Flag) return null;
  return (
    <span className="inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-sm border border-border">
      <Flag aria-hidden={true} className="size-full" />
    </span>
  );
}

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("projects.workspace");
  const dateFormat = useDateFormat();
  const [completing, setCompleting] = useState(false);
  const [feedback, setFeedback] = useState<React.ReactNode>("");
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
      setFeedback(t("completedFeedback"));
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.get.queryOptions({ input: { projectId } })
          .queryKey,
      });
    } catch (error) {
      setFeedback(<ErrorPresentation error={error} />);
    } finally {
      setCompleting(false);
    }
  }

  const daysLeft = project.daysLeft;
  // All stats share one fate: the numbers below mix long-standing fields
  // (derived from partnerOrganizations) with newly added ones. A stale
  // cached response can carry the former without the latter, so the whole
  // strip stays in loading state until the complete shape is present —
  // two numbers must never render while the third is still missing.
  const statsReady =
    typeof project.participantCount === "number" &&
    typeof project.daysLeft === "number";
  // Only submitted Claims await a Hosting decision. A correction request
  // reopens Partner editing, so counting it would overstate the work queue.
  const openClaims =
    project.relationship === "hosted"
      ? project.partnerOrganizations.filter(({ claimStatus }) =>
          isClaimAwaitingReview(claimStatus),
        ).length
      : 0;

  return (
    <div
      className="space-y-8"
      data-project-id={project.id}
      data-relationship={project.relationship}
      data-testid="project-workspace"
    >
      <header className="space-y-4">
        <ProtectedPageHeader
          eyebrow={
            project.relationship === "hosted"
              ? t("hostedProject")
              : t("partnerProject")
          }
          title={project.name}
          rightButton={
            canComplete ? (
              <Button
                disabled={completing}
                onClick={completeProject}
                data-testid="complete-project"
                type="button"
              >
                {completing ? t("completing") : t("complete")}
              </Button>
            ) : undefined
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          {project.archived && <Badge variant="secondary">{t("archived")}</Badge>}
          {project.completedAt && (
            <Badge data-testid="project-completed" variant="secondary">
              {t("completed")}
            </Badge>
          )}
          <Badge
            variant={
              project.costSubmissionWindowOpen ? "status-pass" : "secondary"
            }
          >
            {t("submissionWindow")}{" "}
            {project.costSubmissionWindowOpen ? t("open") : t("closed")}
          </Badge>
        </div>
        {feedback && (
          <div
            data-testid="project-feedback"
            aria-live="polite"
            aria-atomic="true"
            className="text-sm"
          >
            {feedback}
          </div>
        )}
      </header>

      {statsReady ? (
        <StatGrid
          aria-label={t("details")}
          columns={project.relationship === "hosted" ? "three" : "two"}
        >
          {project.relationship === "hosted" ? (
            <>
              <StatCell
                hero
                data-testid="stat-open-claims"
                data-value={openClaims}
              >
                <StatNumber>{openClaims}</StatNumber>
                <StatLabel>{t("claimsInReview")}</StatLabel>
                <StatDetail>{t("claimsInReviewDetail")}</StatDetail>
              </StatCell>
              <StatCell data-testid="stat-partners">
                <StatNumber>{project.partnerOrganizations.length}</StatNumber>
                <StatLabel>{t("statPartners")}</StatLabel>
                <StatDetail>{t("statPartnersDetail")}</StatDetail>
              </StatCell>
              <StatCell data-testid="stat-participants">
                <StatNumber>{project.participantCount}</StatNumber>
                <StatLabel>{t("statParticipants")}</StatLabel>
                <StatDetail>{t("statParticipantsDetail")}</StatDetail>
              </StatCell>
            </>
          ) : (
            <>
              <StatCell hero data-testid="stat-participants">
                <StatNumber>{project.participantCount}</StatNumber>
                <StatLabel>{t("statParticipants")}</StatLabel>
                <StatDetail>{t("statParticipantsDetail")}</StatDetail>
              </StatCell>
              <StatCell data-testid="stat-days-left">
                <StatNumber>{daysLeft >= 0 ? daysLeft : "–"}</StatNumber>
                <StatLabel>
                  {daysLeft >= 0
                    ? t("daysLeft", { count: daysLeft })
                    : t("ended")}
                </StatLabel>
                <StatDetail>
                  {t("daysUntil", {
                    date: dateFormat.format(project.endDate, "date.medium"),
                  })}
                </StatDetail>
              </StatCell>
            </>
          )}
        </StatGrid>
      ) : (
        <StatsSkeletonGrid
          columns={project.relationship === "hosted" ? "three" : "two"}
          label={t("details")}
          testId="stats-loading"
        />
      )}

      <section
        aria-label={t("details")}
        className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div className="flex gap-3">
          <CalendarDaysIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs text-muted-foreground">{t("schedule")}</p>
            <p className="text-sm font-medium">
              {dateFormat.range(project.startDate, project.endDate, "date.long")}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <MapPinIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs text-muted-foreground">{t("location")}</p>
            <p className="flex items-center gap-2 text-sm font-medium">
              <CountryFlag country={project.country} />
              <span className="truncate">
                {[project.location, project.country].filter(Boolean).join(", ")}
              </span>
            </p>
          </div>
        </div>
        {project.completedAt && (
          <div
            className="flex gap-3"
            data-completed-at={project.completedAt.toISOString()}
            data-completed-by-user-id={project.completedByUserId}
          >
            <CheckIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs text-muted-foreground">{t("completed")}</p>
              <p className="text-sm font-medium">
                {dateFormat.format(project.completedAt, "dateTime.short")}
                {project.completedByUserName ? (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    {t("by")} {project.completedByUserName}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        )}
      </section>

      {project.relationship === "hosted" ? (
        <Card data-testid="assigned-partner-organizations">
          <CardHeader>
            <div>
              <CardTitle as="h2">{t("assignedPartners")}</CardTitle>
            </div>
            <CardAction>
              <Badge variant="ember-pill">
                {t("partnersCount", {
                  count: project.partnerOrganizations.length,
                })}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            {project.partnerOrganizations.length === 0 ? (
              <p
                data-testid="assigned-partnerships-empty"
                className="space-y-2 rounded-2xl border p-8 text-center text-sm text-muted-foreground"
              >
                {t("noPartners")}{" "}
                <Link
                  className={buttonVariants({ variant: "link" })}
                  href="/partner-organizations"
                >
                  {t("invitePartners")}
                </Link>
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {project.partnerOrganizations.map((partner) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4 first:pt-0 last:pb-0"
                    data-organization-id={partner.organizationId}
                    data-partnership-id={partner.id}
                    key={partner.id}
                  >
                    <div className="min-w-0 space-y-0.5">
                      {/* The Partnership detail route is deliberately
                          header-only this release, so the row links to that
                          Partner's Participants instead — the actionable
                          destination for this Partnership. */}
                      <Link
                        className="block truncate font-medium hover:underline"
                        href={partnershipParticipantsPath(partner.id)}
                      >
                        {partner.organizationName}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {t("assigned")}{" "}
                        {dateFormat.format(partner.assignedAt, "date.medium")}
                      </p>
                    </div>
                    <ClaimReadiness status={partner.claimStatus} />
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Link
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                })}
                href={projectParticipantsPath(project.id)}
                data-testid="hosted-participants"
              >
                <UsersIcon aria-hidden="true" />
                {t("participantsReport")}
              </Link>
              <Link
                className={buttonVariants({
                  variant: "link",
                  size: "sm",
                })}
                href="/claims/review"
              >
                <EntityIcon entity="claim" className="size-3.5" />
                {t("reviewClaims")}
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("partnership")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex items-center gap-3"
              data-organization-id={project.hostingOrganization.id}
              data-testid="hosting-organization"
            >
              <EntityIcon
                entity="organization"
                className="size-5 shrink-0 text-muted-foreground"
              />
              <p className="text-sm">
                <span className="text-muted-foreground">
                  {t("hostingOrganization")}{" "}
                </span>
                <span className="font-medium">
                  {project.hostingOrganization.name}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-5 shrink-0" aria-hidden="true" />
              <p className="text-sm">
                <span className="text-muted-foreground">
                  {t("claimReadiness")}{" "}
                </span>
                <ClaimReadiness status={project.partnership.claimStatus} />
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("assignedLabel")}{" "}
              {dateFormat.format(project.partnership.assignedAt, "date.medium")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("assignmentUpdated")}{" "}
              {dateFormat.format(project.partnership.updatedAt, "date.medium")}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                })}
                href={partnershipParticipantsPath(project.partnership.id)}
                data-testid="coordinate-participants"
              >
                <UsersIcon aria-hidden="true" />
                {t("projectParticipations")}
              </Link>
              <Link
                className={buttonVariants({
                  variant: "link",
                  size: "sm",
                })}
                href={partnershipClaimPath(project.partnership.id)}
                data-testid="open-claim-workspace"
              >
                <EntityIcon entity="claim" className="size-3.5" />
                {t("openClaim")}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
