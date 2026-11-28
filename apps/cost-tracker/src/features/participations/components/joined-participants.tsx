"use client";

import { useTranslations } from "@greendex/i18n/client";

import { participationPath } from "@/app/paths";
import { useConfirmDialog } from "@/components/confirm-dialog";
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
import { Link } from "@/lib/i18n/routing";
import type { Outputs } from "@/lib/orpc/router";
import { viewTransitionType } from "@/lib/view-transitions";

export function JoinedParticipants({
  data,
  partnershipId,
  entryAccess,
  removeParticipation,
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
  setFeedback: (value: undefined) => void;
}) {
  const t = useTranslations("participations");
  const { confirm, dialog } = useConfirmDialog();
  return (
    <Card data-testid="joined-participants">
      {dialog}
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
                  <strong id={`participation-name-${participant.id}`}>
                    {participant.displayName}
                  </strong>
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
                  className={buttonVariants({ variant: "link" })}
                  aria-describedby={`participation-name-${participant.id}`}
                  href={participationPath(partnershipId, participant.id)}
                  data-testid={`participant-details-${participant.id}`}
                  transitionTypes={[viewTransitionType.forward]}
                >
                  {t("joined.detailsFor")}
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
