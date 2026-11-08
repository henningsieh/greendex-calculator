"use client";

import { useTranslations } from "@greendex/i18n/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { EntityIcon } from "@/components/entity-icon";
import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { Button } from "@/components/ui/button";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

import { invalidatePartnershipProjectData } from "./invalidate-partnership-data";
import {
  ProjectPartnershipAssigner,
  type PartnershipFeedback,
} from "./project-partnership-assigner";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function mutationMessage(error: unknown) {
  return <ErrorPresentation error={error} />;
}

/**
 * Lists Project Partnerships for the active Organization and handles removals.
 * The assignment form lives in a child that only mounts for viewers who may
 * assign, so assign-only data is never fetched for readers.
 */
export function ProjectPartnershipManager({
  canAssign = false,
}: {
  canAssign?: boolean;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("partnerships");
  const { confirm, dialog } = useConfirmDialog();
  const { data: partnerships } = useSuspenseQuery(
    orpcQuery.projectPartnerships.list.queryOptions({
      meta: { costTrackerORPC: true },
    }),
  );
  const [feedback, setFeedback] = useState<PartnershipFeedback | undefined>();

  const removeMutation = useMutation({
    mutationFn: (id: string) => orpc.projectPartnerships.remove({ id }),
    onSuccess: async () => {
      setFeedback({
        message: "Project Partnership removed.",
        status: "success",
      });
      await invalidatePartnershipProjectData(queryClient);
    },
    onError: (error) => {
      setFeedback({ message: mutationMessage(error), status: "error" });
    },
  });

  return (
    <section className="mt-10 space-y-8">
      {dialog}
      {/* Mounted only for viewers who may assign: the form fetches its own
          hosted-project options, so readers never fetch what they cannot use.
          Feedback stays shared, so assignment and removal report into one slot. */}
      {canAssign && (
        <ProjectPartnershipAssigner
          partnerships={partnerships}
          feedback={feedback}
          onFeedback={setFeedback}
        />
      )}

      <div className="space-y-4">
        <h2 className="font-heading text-2xl font-semibold">
          {t("manager.current")}
        </h2>
        {partnerships.length === 0 ? (
          <p
            data-testid="partnerships-empty"
            className="rounded-xl border p-8 text-center text-muted-foreground"
          >
            {t("manager.none")}
          </p>
        ) : (
          <ul className="grid gap-4">
            {partnerships.map((partnership) => (
              <li
                className="flex flex-col justify-between gap-5 rounded-xl border p-5 sm:flex-row sm:items-center"
                data-testid={`partnership-row-${partnership.organizationId}`}
                key={partnership.id}
              >
                <div className="flex gap-3">
                  <EntityIcon
                    entity="partnerOrganization"
                    className="mt-1 size-5 text-muted-foreground"
                  />
                  <div>
                    <p className="font-medium">{partnership.organizationName}</p>
                    <p className="text-sm text-muted-foreground">
                      {partnership.projectName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("manager.assigned")}{" "}
                      {dateTimeFormatter.format(partnership.assignedAt)}{" "}
                      {t("manager.updated")}{" "}
                      {dateTimeFormatter.format(partnership.updatedAt)}
                    </p>
                  </div>
                </div>
                {canAssign && (
                  <Button
                    disabled={removeMutation.isPending}
                    data-testid={`remove-partnership-${partnership.id}`}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: t("confirmations.removePartnership.title"),
                          description: t(
                            "confirmations.removePartnership.description",
                            {
                              organization: partnership.organizationName,
                              project: partnership.projectName,
                            },
                          ),
                          confirmText: t(
                            "confirmations.removePartnership.execute",
                          ),
                          isDestructive: true,
                        })
                      ) {
                        setFeedback(undefined);
                        removeMutation.mutate(partnership.id);
                      }
                    }}
                    type="button"
                    variant="destructive"
                  >
                    <Trash2Icon aria-hidden="true" />
                    {removeMutation.isPending &&
                    removeMutation.variables === partnership.id
                      ? t("confirmations.pending")
                      : t("manager.remove")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
