"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useDateFormat } from "@greendex/i18n/datetime/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDaysIcon, MapPinIcon, Users2Icon } from "lucide-react";
import { Suspense, useRef, useSyncExternalStore } from "react";

import { partnershipClaimPath } from "@/app/paths";
import { ButtonLink } from "@/components/button-link";
import { CountryFlag } from "@/components/country-flag";
import { EntityIcon } from "@/components/entity-icon";
import { OrgAvatar } from "@/components/org-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";
import { ParticipantsLink } from "@/features/breadcrumbs/components/participants-link";
import { ProtectedRouteHeader } from "@/features/breadcrumbs/components/protected-route-header";
import { useParticipationLabel } from "@/features/breadcrumbs/use-participation-label";
import {
  type ClaimStatus,
  isClaimAwaitingReview,
  isClaimReviewable,
} from "@/features/claims/claim-lifecycle";
import { ClaimReviewLink } from "@/features/claims/components/claim-review-link";
import { ClaimStatusBadge } from "@/features/claims/components/claim-status-badge";
import {
  PartnershipActions,
  PartnershipShortcutLinks,
} from "@/features/partnerships/components/partnership-actions";
import { ProjectOptionsLoading } from "@/features/partnerships/components/project-options-loading";
import { ProjectLifecycleActions } from "@/features/projects/components/project-lifecycle-actions";
import { ProjectMetrics } from "@/features/projects/components/project-metrics";
import { ProjectMetricsLoading } from "@/features/projects/components/project-metrics-loading";
import {
  ProjectArchiveBadge,
  ProjectStatusBadge,
} from "@/features/projects/components/project-status-badge";
import { projectStatus } from "@/features/projects/project-lifecycle";
import type { ProjectPartnershipSummary } from "@/features/projects/validation-schemas";
import { orpcQuery } from "@/lib/orpc/orpc";
import { viewTransitionType } from "@/lib/view-transitions";

function ProjectMetric({
  label,
  value,
  detail,
  testId,
}: {
  label: string;
  value: number | string;
  detail: string;
  testId: string;
}) {
  return (
    <div
      className="row-span-3 grid min-w-0 grid-rows-subgrid p-3 wrap-anywhere sm:px-5"
      data-testid={testId}
      data-value={value}
    >
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </dd>
      <dd className="text-sm text-muted-foreground">{detail}</dd>
    </div>
  );
}

/**
 * Assigned Partners card (hosted view). Owns the partnership dialogs in its
 * header toolbar — secondary outline openers next to the count badge — so
 * the page header keeps only the single irreversible project action.
 */
function AssignedPartnersCard({
  partners,
  projectId,
  archived,
  showDialogs,
}: {
  partners: readonly ProjectPartnershipSummary[];
  projectId: string;
  archived: boolean;
  showDialogs: boolean;
}) {
  const t = useTranslations("projects.workspace");
  const dateFormat = useDateFormat();
  return (
    <Card size="sm" data-testid="assigned-partner-organizations">
      <CardHeader className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <CardTitle as="h2">{t("partnerships")}</CardTitle>
          <Badge variant="outline">
            {t("partnersCount", { count: partners.length })}
          </Badge>
        </div>
        {!archived && showDialogs ? (
          <Suspense fallback={<ProjectOptionsLoading />}>
            <PartnershipActions projectId={projectId} tone="secondary" />
          </Suspense>
        ) : null}
      </CardHeader>
      <CardContent>
        {partners.length === 0 ? (
          <Empty data-testid="assigned-partnerships-empty" variant="outlined">
            <EmptyMedia variant="icon">
              <Users2Icon
                aria-hidden="true"
                className="size-7 text-muted-foreground"
              />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyDescription>
                {t("noPartners")}{" "}
                {showDialogs && !archived ? (
                  <Suspense fallback={null}>
                    <span data-testid="partnership-shortcut-intro">
                      {t("noPartnersActionIntro")}{" "}
                    </span>
                    <PartnershipShortcutLinks projectId={projectId} />
                  </Suspense>
                ) : null}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y divide-border border-t">
            {partners.map((partner) => (
              <li
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4 last:pb-0"
                data-organization-id={partner.organizationId}
                data-partnership-id={partner.id}
                key={partner.id}
              >
                <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
                  <OrgAvatar name={partner.organizationName} />
                  <div className="min-w-0 space-y-0.5">
                    <p
                      className="font-medium wrap-anywhere"
                      id={`project-partner-${partner.id}`}
                    >
                      {partner.organizationName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("assigned")}{" "}
                      {dateFormat.format(partner.assignedAt, "date.medium")}
                    </p>
                  </div>
                </div>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <ClaimStatusBadge status={partner.claimStatus} />
                  <ParticipantsLink
                    partnershipId={partner.id}
                    describedBy={`project-partner-${partner.id}`}
                    testId={`partnership-participations-${partner.id}`}
                  />
                  {/* The review page hangs under this Hosted Project, so
                      the row is its way in: the global queue also lists
                      every submitted Claim, this links one Partnership.
                      No reviewable Claim means no link at all — the badge
                      already carries the state, so an inert duplicate would
                      only pretend at navigation. */}
                  {isClaimReviewable(partner.claimStatus) ? (
                    <ClaimReviewLink
                      describedBy={`project-partner-${partner.id}`}
                      partnershipId={partner.id}
                      testId={`review-claim-${partner.id}`}
                    />
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Partner view: hosting identity and the two related workspaces as links. */
function PartnerProjectCard({
  hostingId,
  hostingName,
  partnership,
}: {
  hostingId: string;
  hostingName: string;
  partnership: {
    id: string;
    claimStatus: ClaimStatus | null;
    assignedAt: Date;
    updatedAt: Date;
  };
}) {
  const t = useTranslations("projects.workspace");
  const dateFormat = useDateFormat();
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle as="h2">{t("partnership")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div
            className="min-w-0"
            data-organization-id={hostingId}
            data-testid="hosting-organization"
          >
            <dt className="text-xs text-muted-foreground">
              {t("hostingOrganization")}
            </dt>
            <dd className="mt-1 font-medium wrap-anywhere">{hostingName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("claimReadiness")}
            </dt>
            <dd className="mt-1">
              <ClaimStatusBadge status={partnership.claimStatus} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("assignedLabel")}
            </dt>
            <dd className="mt-1 tabular-nums">
              {dateFormat.format(partnership.assignedAt, "date.medium")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("assignmentUpdated")}
            </dt>
            <dd className="mt-1 tabular-nums">
              {dateFormat.format(partnership.updatedAt, "date.medium")}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3">
          <ButtonLink
            href={partnershipClaimPath(partnership.id)}
            transitionTypes={[viewTransitionType.forward]}
            icon={<EntityIcon className="size-3.5 shrink-0" entity="claim" />}
            testId="open-claim-workspace"
          >
            {t("openClaim")}
          </ButtonLink>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectWorkspace({
  projectId,
  canManagePartnerships = false,
}: {
  projectId: string;
  /** Presentation-only: the dialogs re-enforce on every call. */
  canManagePartnerships?: boolean;
}) {
  const t = useTranslations("projects.workspace");
  const participantLabel = useParticipationLabel("participants");
  const dateFormat = useDateFormat();
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const { data: project } = useSuspenseQuery(
    orpcQuery.projects.get.queryOptions({
      input: { projectId },
      meta: { costTrackerORPC: true },
    }),
  );
  // Archiving unmounts its own trigger, so this container is the deliberate
  // focus landing place instead of a detached node or body.
  const workspace = useRef<HTMLDivElement>(null);

  const isHosted = project.relationship === "hosted";

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
      className="flex min-w-0 flex-col gap-6"
      data-hydrated={isHydrated ? "true" : undefined}
      data-archived={project.archived}
      data-project-id={project.id}
      data-relationship={project.relationship}
      data-testid="project-workspace"
      ref={workspace}
      tabIndex={-1}
    >
      <ProtectedRouteHeader
        page="project"
        context={{ projectId: project.id, relationship: project.relationship }}
        title={project.name}
        rightButton={
          <div className="flex flex-wrap items-center gap-3">
            {project.relationship === "hosted" ? (
              <ProjectStatusBadge
                status={projectStatus(
                  project.archived,
                  project.partnerOrganizations.map(
                    ({ claimStatus }) => claimStatus,
                  ),
                )}
              />
            ) : (
              <ProjectArchiveBadge
                status={project.archived ? "archived" : "active"}
              />
            )}
            <ProjectLifecycleActions
              focusAfterArchive={workspace}
              projectId={project.id}
            />
          </div>
        }
      />
      <section
        data-testid="project-facts"
        aria-label={t("details")}
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3"
      >
        <dl className="flex min-w-0 flex-1 basis-full flex-wrap gap-x-8 gap-y-3 sm:basis-0">
          <div className="relative min-w-0 pl-6">
            <dt className="text-xs text-muted-foreground">
              <CalendarDaysIcon
                aria-hidden="true"
                className="absolute top-0 left-0 size-4 text-muted-foreground"
              />
              {t("schedule")}
            </dt>
            <dd className="text-sm font-medium tabular-nums">
              {dateFormat.range(project.startDate, project.endDate, "date.long")}
            </dd>
          </div>
          <div className="relative min-w-0 pl-6">
            <dt className="text-xs text-muted-foreground">
              <MapPinIcon
                aria-hidden="true"
                className="absolute top-0 left-0 size-4 text-muted-foreground"
              />
              {t("location")}
            </dt>
            <dd className="flex items-center gap-2 text-sm font-medium">
              <CountryFlag code={project.country} />
              <span className="wrap-anywhere">
                {[project.location, project.country].filter(Boolean).join(", ")}
              </span>
            </dd>
          </div>
        </dl>
        {project.relationship === "hosted" ? (
          <ParticipantsLink
            projectId={project.id}
            className="max-w-full whitespace-normal"
          />
        ) : (
          <ParticipantsLink
            partnershipId={project.partnership.id}
            className="max-w-full whitespace-normal"
          />
        )}
      </section>

      {statsReady ? (
        <ProjectMetrics
          columns={isHosted ? "three" : "two"}
          aria-label={t("details")}
        >
          {project.relationship === "hosted" && (
            <>
              <ProjectMetric
                label={t("claimsInReview")}
                value={openClaims}
                detail={t("claimsInReviewDetail")}
                testId="stat-open-claims"
              />
              <ProjectMetric
                label={t("statPartners")}
                value={project.partnerOrganizations.length}
                detail={t("statPartnersDetail")}
                testId="stat-partners"
              />
            </>
          )}
          <ProjectMetric
            label={participantLabel}
            value={project.participantCount}
            detail={t("statParticipantsDetail")}
            testId="stat-participants"
          />
          {!isHosted && (
            <ProjectMetric
              label={
                daysLeft >= 0 ? t("daysLeft", { count: daysLeft }) : t("ended")
              }
              value={daysLeft >= 0 ? daysLeft : "–"}
              detail={t("daysUntil", {
                date: dateFormat.format(project.endDate, "date.medium"),
              })}
              testId="stat-days-left"
            />
          )}
        </ProjectMetrics>
      ) : (
        <ProjectMetricsLoading
          columns={isHosted ? "three" : "two"}
          label={t("details")}
          testId="stats-loading"
        />
      )}

      {project.relationship === "hosted" ? (
        <AssignedPartnersCard
          archived={project.archived}
          partners={project.partnerOrganizations}
          projectId={project.id}
          showDialogs={canManagePartnerships && isHosted}
        />
      ) : (
        <PartnerProjectCard
          hostingId={project.hostingOrganization.id}
          hostingName={project.hostingOrganization.name}
          partnership={project.partnership}
        />
      )}
    </div>
  );
}
