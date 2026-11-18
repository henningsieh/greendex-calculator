"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useDateFormat } from "@greendex/i18n/datetime/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  MapPinIcon,
  Users2Icon,
  UsersIcon,
} from "lucide-react";
import { Suspense, useSyncExternalStore } from "react";

import {
  partnershipClaimPath,
  partnershipClaimReviewPath,
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
import { CountryFlag } from "@/components/country-flag";
import { EntityIcon } from "@/components/entity-icon";
import { OrgAvatar } from "@/components/org-avatar";
import ProtectedPageHeader from "@/components/protected-page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";
import {
  type ClaimStatus,
  isClaimAwaitingReview,
  isClaimReviewable,
} from "@/features/claims/claim-lifecycle";
import {
  PartnershipActions,
  PartnershipShortcutLinks,
} from "@/features/partnerships/components/partnership-actions";
import { ProjectOptionsLoading } from "@/features/partnerships/components/project-options-loading";
import { ProjectLifecycleActions } from "@/features/projects/components/project-lifecycle-actions";
import { StatsSkeletonGrid } from "@/features/projects/components/project-loading-states";
import { Link } from "@/lib/i18n/routing";
import { orpcQuery } from "@/lib/orpc/orpc";

function ClaimReadiness({ status }: { status: ClaimStatus | null }) {
  const t = useTranslations("projects.workspace");
  if (!status) {
    return (
      <Badge data-claim-status="none" variant="secondary">
        {t("noClaim")}
      </Badge>
    );
  }
  const labels: Record<ClaimStatus, string> = {
    in_preparation: t("claimStatus.in_preparation"),
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
        status === "submitted"
          ? "status-attention"
          : status === "correction_requested"
            ? "destructive"
            : status === "approved"
              ? "status-success"
              : status === "rejected"
                ? "status-destructive-solid"
                : status === "paid"
                  ? "status-success-solid"
                  : "secondary"
      }
    >
      {labels[status]}
    </Badge>
  );
}

type AssignedPartner = {
  id: string;
  organizationId: string;
  organizationName: string;
  claimStatus: ClaimStatus | null;
  assignedAt: Date;
};

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
  partners: readonly AssignedPartner[];
  projectId: string;
  archived: boolean;
  showDialogs: boolean;
}) {
  const t = useTranslations("projects.workspace");
  const dateFormat = useDateFormat();
  return (
    <Card data-testid="assigned-partner-organizations">
      <CardHeader>
        <div>
          <CardTitle as="h2">{t("assignedPartners")}</CardTitle>
        </div>
        <CardAction>
          {archived ? (
            <Badge variant="status-destructive-solid">{t("archived")}</Badge>
          ) : showDialogs ? (
            <Suspense fallback={<ProjectOptionsLoading />}>
              <PartnershipActions projectId={projectId} tone="secondary" />
            </Suspense>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-start gap-2">
          <Badge variant="outline">
            <EntityIcon entity="partnerOrganization" className="size-3" />
            {t("partnersCount", { count: partners.length })}
          </Badge>
        </div>
        {partners.length === 0 ? (
          <Empty data-testid="assigned-partnerships-empty" variant="outlined">
            <EmptyMedia variant="icon">
              <Users2Icon
                aria-hidden="true"
                className="size-7 text-muted-foreground"
              />
              {/* <EntityIcon entity="partnerOrganization" /> */}
            </EmptyMedia>
            <EmptyHeader>
              <EmptyDescription>
                {t("noPartners")}{" "}
                {showDialogs && !archived ? (
                  <Suspense fallback={null}>
                    <PartnershipShortcutLinks projectId={projectId} />
                  </Suspense>
                ) : null}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div
            className={showDialogs ? "border-t border-border/60 pt-5" : undefined}
          >
            <ul className="divide-y divide-border">
              {partners.map((partner) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4 first:pt-0 last:pb-0"
                  data-organization-id={partner.organizationId}
                  data-partnership-id={partner.id}
                  key={partner.id}
                >
                  <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
                    <OrgAvatar name={partner.organizationName} />
                    <div className="min-w-0 space-y-0.5">
                      {/* The Partnership detail route is deliberately
                        header-only this release, so the row links to that
                        Partner's Participants instead — the actionable
                        destination for this Partnership. */}
                      <Link
                        className="block font-medium wrap-break-word underline-offset-4 hover:underline hover:decoration-brand hover:decoration-2"
                        href={partnershipParticipantsPath(partner.id)}
                      >
                        {partner.organizationName}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {t("assigned")}{" "}
                        {dateFormat.format(partner.assignedAt, "date.medium")}
                      </p>
                    </div>
                  </div>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <ClaimReadiness status={partner.claimStatus} />
                    {/* The review page hangs under this Hosted Project, so
                      the row is its way in: the global queue also lists
                      every submitted Claim, this links one Partnership.
                      No reviewable Claim means no link at all — the badge
                      already carries the state, so an inert duplicate would
                      only pretend at navigation. */}
                    {isClaimReviewable(partner.claimStatus) ? (
                      <Link
                        className={buttonVariants({
                          variant: "link",
                          size: "sm",
                        })}
                        href={partnershipClaimReviewPath(partner.id)}
                        data-testid={`review-claim-${partner.id}`}
                      >
                        <EntityIcon entity="claim" className="size-3.5" />
                        {t("claimReview")}
                        <ArrowUpRightIcon aria-hidden="true" />
                      </Link>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
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
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t("partnership")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex items-center gap-3"
          data-organization-id={hostingId}
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
            <span className="font-medium">{hostingName}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm">
            <span className="text-muted-foreground">{t("claimReadiness")} </span>
            <ClaimReadiness status={partnership.claimStatus} />
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("assignedLabel")}{" "}
          {dateFormat.format(partnership.assignedAt, "date.medium")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("assignmentUpdated")}{" "}
          {dateFormat.format(partnership.updatedAt, "date.medium")}
        </p>
        {/* Both entries navigate to related workspaces: typographic
            links with arrows, never outline buttons that read as actions. */}
        <div className="flex flex-wrap gap-x-2 gap-y-1 pt-1">
          <Link
            className={buttonVariants({
              variant: "link",
              size: "sm",
            })}
            href={partnershipParticipantsPath(partnership.id)}
            data-testid="coordinate-participants"
          >
            <UsersIcon aria-hidden="true" />
            {t("projectParticipations")}
            <ArrowUpRightIcon aria-hidden="true" />
          </Link>
          <Link
            className={buttonVariants({
              variant: "link",
              size: "sm",
            })}
            href={partnershipClaimPath(partnership.id)}
            data-testid="open-claim-workspace"
          >
            <EntityIcon entity="claim" className="size-3.5" />
            {t("openClaim")}
            <ArrowUpRightIcon aria-hidden="true" />
          </Link>
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
      className="space-y-8"
      data-hydrated={isHydrated ? "true" : undefined}
      data-archived={project.archived}
      data-project-id={project.id}
      data-relationship={project.relationship}
      data-testid="project-workspace"
    >
      <header className="space-y-4">
        {/* Lifecycle owns its buttons, dialogs and feedback: the header
            only hands the component over into its action slot. */}
        <ProtectedPageHeader
          eyebrow={
            project.relationship === "hosted"
              ? t("hostedProject")
              : t("partnerProject")
          }
          title={project.name}
          rightButton={<ProjectLifecycleActions projectId={project.id} />}
        />
        {/* Hosted archived state lives as a destructive badge in the
            AssignedPartnersCard action slot; the header keeps it only for
            partner views, which have no such card. */}
        {project.archived && !isHosted ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t("archived")}</Badge>
          </div>
        ) : null}
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
        className="flex items-start justify-between gap-6"
      >
        {/* Facts stack on phones and share one row from sm; the Participants
            entry always sits at the trailing edge, never inside the column. */}
        <div className="flex min-w-0 flex-1 flex-col gap-6 sm:flex-row sm:flex-wrap sm:gap-x-8">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
              <CalendarDaysIcon
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs text-muted-foreground">{t("schedule")}</p>
              <p className="text-sm font-medium">
                {dateFormat.range(
                  project.startDate,
                  project.endDate,
                  "date.long",
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
              <MapPinIcon
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs text-muted-foreground">{t("location")}</p>
              <p className="flex items-center gap-2 text-sm font-medium">
                <CountryFlag code={project.country} />
                <span className="truncate">
                  {[project.location, project.country].filter(Boolean).join(", ")}
                </span>
              </p>
            </div>
          </div>
        </div>
        {project.relationship === "hosted" && (
          <div className="flex shrink-0 items-center">
            {/* Navigation, not an action: typographic link with an arrow. */}
            <Link
              className={buttonVariants({ variant: "link", size: "sm" })}
              href={projectParticipantsPath(project.id)}
              data-testid="hosted-participants"
            >
              <UsersIcon aria-hidden="true" />
              {t("participants")}
              <ArrowUpRightIcon aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

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
