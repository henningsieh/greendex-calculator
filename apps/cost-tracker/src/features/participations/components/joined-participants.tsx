"use client";

import { useTranslations } from "@greendex/i18n/client";
import Link from "next/link";

import type { useConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { Outputs } from "@/lib/orpc/router";

export function JoinedParticipants({
  data,
  partnershipId,
  entryAccess,
  removeParticipation,
  confirm,
  setFeedback,
}: {
  data: Pick<
    Outputs["participations"]["listPartnership"],
    "participations" | "projectName"
  >;
  partnershipId: string;
  entryAccess: { permitted: boolean };
  removeParticipation: {
    isPending: boolean;
    variables: string | undefined;
    mutate: (id: string) => void;
  };
  confirm: ReturnType<typeof useConfirmDialog>["confirm"];
  setFeedback: (value: undefined) => void;
}) {
  const t = useTranslations("participations");
  return (
    <Card data-testid="joined-participants">
      <CardHeader>
        <CardTitle>{t("joined.title")}</CardTitle>
        {data.participations.length > 0 && (
          <CardDescription>
            {t("joined.count", {
              count: data.participations.length,
              project: data.projectName,
            })}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {data.participations.length === 0 ? (
          <Empty data-testid="joined-participants-empty">
            <EmptyHeader>
              <EmptyTitle>{t("joined.empty")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y">
            {data.participations.map((participant) => (
              <li
                className="space-y-3 py-4"
                data-testid={`joined-participant-${participant.id}`}
                key={participant.id}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <strong>{participant.displayName}</strong>
                  <Badge variant="secondary" data-participation-state="joined">
                    {t("joined.joined")}
                  </Badge>
                </div>
                {participant.email && (
                  <p className="text-sm text-muted-foreground">
                    {participant.email}
                  </p>
                )}
                <p className="flex flex-wrap items-center gap-3 text-sm">
                  <span>{t("joined.country")}</span>
                  <Badge variant="secondary">
                    {participant.country ?? t("details.notSet")}
                  </Badge>
                </p>
                {/* Editing belongs on the details page, never in a list row (ADR-0016). */}
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={`/partnerships/${encodeURIComponent(partnershipId)}/participants/${encodeURIComponent(participant.id)}`}
                  data-testid={`participant-details-${participant.id}`}
                >
                  {t("joined.detailsFor")} {participant.displayName}
                </Link>
                {entryAccess.permitted && (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={removeParticipation.isPending}
                    data-testid={`remove-participation-${participant.id}`}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: t("confirmations.removeParticipation.title"),
                          description: t(
                            "confirmations.removeParticipation.description",
                            {
                              participant: participant.displayName,
                            },
                          ),
                          confirmText: t(
                            "confirmations.removeParticipation.execute",
                          ),
                          isDestructive: true,
                        })
                      ) {
                        setFeedback(undefined);
                        removeParticipation.mutate(participant.id);
                      }
                    }}
                  >
                    {removeParticipation.isPending &&
                    removeParticipation.variables === participant.id
                      ? t("confirmations.pending")
                      : t("joined.removeFor", {
                          name: participant.displayName,
                        })}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
