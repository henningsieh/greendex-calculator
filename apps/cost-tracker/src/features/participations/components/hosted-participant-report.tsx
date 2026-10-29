"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Building2Icon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

type ParticipantReport = Outputs["participations"]["listHostedReport"];
type PartnerOrganizationGroup = ParticipantReport["organizations"][number];

function pluralize(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

/**
 * Read-only Hosting Participant view of this Project's Participants, grouped by the
 * Partner Organization each represents (ADR-0016). It offers expanding and
 * navigating only: no editing, invitation or removal control exists here, and
 * the Partner workspace keeps its own controls unchanged.
 */
export function HostedParticipantReport({ projectId }: { projectId: string }) {
  const t = useTranslations("participations.report");
  const { data } = useSuspenseQuery(
    orpcQuery.participations.listHostedReport.queryOptions({
      input: { projectId },
      meta: { costTrackerORPC: true },
    }),
  );

  return (
    <section
      data-testid="hosted-participant-report"
      aria-label={t("label")}
      className="space-y-6"
      data-agreement-published={data.agreement.published}
    >
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {!data.agreement.published && (
        <p
          className="text-sm text-muted-foreground"
          data-testid="unpublished-agreement"
        >
          {t("agreementVersion")} {data.agreement.versionId}{" "}
          {t("agreementUnpublished")}
        </p>
      )}
      {data.organizations.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("empty")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        data.organizations.map((group) => (
          <PartnerOrganizationParticipants group={group} key={group.id} />
        ))
      )}
    </section>
  );
}

function PartnerOrganizationParticipants({
  group,
}: {
  group: PartnerOrganizationGroup;
}) {
  const t = useTranslations("participations.report");
  const [expanded, setExpanded] = useState(false);
  const participantsId = `participants-${group.id}`;

  return (
    <Card data-testid={`report-organization-${group.id}`}>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>
          <span className="flex items-center gap-2">
            <Building2Icon
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
            {group.name}
          </span>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            data-country={group.country}
          >{`${t("country")} ${group.country}`}</Badge>
          <Badge data-participant-count={group.participantCount}>
            {pluralize(group.participantCount, "Participant")}
          </Badge>
          <Badge
            variant="secondary"
            data-completed-count={group.completedCount}
          >{`${group.completedCount} ${t("completed")}`}</Badge>
          <Badge
            variant="secondary"
            data-pending-count={group.pendingCount}
          >{`${group.pendingCount} ${t("pending")}`}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          data-testid="toggle-report-participants"
          aria-controls={participantsId}
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
          type="button"
          variant="outline"
        >
          {expanded ? (
            <ChevronDownIcon aria-hidden="true" />
          ) : (
            <ChevronRightIcon aria-hidden="true" />
          )}
          {expanded
            ? t("hideParticipants", { count: group.participantCount })
            : t("showParticipants", { count: group.participantCount })}
        </Button>
        {expanded && (
          <ul className="divide-y" id={participantsId}>
            {group.participants.map((participant) => (
              <li
                className="space-y-2 py-4"
                data-testid={`report-participant-${participant.id}`}
                key={participant.id}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <strong>{participant.displayName}</strong>
                  <Badge
                    data-agreement-status={participant.agreement}
                    variant={
                      participant.agreement === "completed"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {participant.agreement === "completed"
                      ? t("agreementCompleted")
                      : t("agreementPending")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {participant.email ?? t("noEmail")}
                </p>
                <p className="flex flex-wrap items-center gap-3 text-sm">
                  <span>{t("countryHeader")}</span>
                  <Badge variant="secondary">
                    {participant.country ?? t("notSet")}
                  </Badge>
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
