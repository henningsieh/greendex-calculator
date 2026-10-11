"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Building2Icon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { data } = useSuspenseQuery(
    orpcQuery.participations.listHostedReport.queryOptions({
      input: { projectId },
      meta: { costTrackerORPC: true },
    }),
  );

  return (
    <section aria-label="Hosting Participant view" className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Totals count the Project Participations that exist, each in the Partner
        Organization it represents. Invitees who have not joined and unknown
        holders of a Participant Registration Link are not counted, so this is not
        a pre-join funnel.
      </p>
      {!data.agreement.published && (
        <p className="text-sm text-muted-foreground">
          Agreement version {data.agreement.versionId} is not published, so no
          Participant counts as completed.
        </p>
      )}
      {data.organizations.length === 0 ? (
        <p>No Project Participations have joined this Project yet.</p>
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
  const [expanded, setExpanded] = useState(false);
  const participantsId = `participants-${group.id}`;

  return (
    <Card>
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
          <Badge variant="secondary">{`Country: ${group.country}`}</Badge>
          <Badge>{pluralize(group.participantCount, "Participant")}</Badge>
          <Badge variant="secondary">{`${group.completedCount} completed`}</Badge>
          <Badge variant="secondary">{`${group.pendingCount} pending`}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
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
            ? `Hide ${pluralize(group.participantCount, "Participant")}`
            : `Show ${pluralize(group.participantCount, "Participant")}`}
        </Button>
        {expanded && (
          <ul className="divide-y" id={participantsId}>
            {group.participants.map((participant) => (
              <li className="space-y-2 py-4" key={participant.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <strong>{participant.displayName}</strong>
                  <Badge
                    variant={
                      participant.agreement === "completed"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {participant.agreement === "completed"
                      ? "Agreement completed"
                      : "Agreement pending"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {participant.email ?? "No email recorded"}
                </p>
                <p className="flex flex-wrap items-center gap-3 text-sm">
                  <span>Country</span>
                  <Badge variant="secondary">
                    {participant.country ?? "Not set"}
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
