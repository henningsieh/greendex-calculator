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

export type PartnershipFeedback = {
  message: React.ReactNode;
  status: "success" | "error";
};

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
 * Creation lives in the page-header dialogs, so this list fetches nothing
 * assign-only — readers and assigners share exactly this query.
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
      {feedback && (
        <div
          aria-live="polite"
          className="text-sm"
          data-testid="partnership-feedback"
          data-state={feedback.status}
        >
          {feedback.message}
        </div>
      )}
      <div className="space-y-4">
        <h2 className="text-2xl">{t("manager.current")}</h2>
        {partnerships.length === 0 ? (
          <p
            data-testid="partnerships-empty"
            className="rounded-2xl border p-8 text-center text-muted-foreground"
          >
            {t("manager.none")}
          </p>
        ) : (
          <ul className="grid gap-4">
            {partnerships.map((partnership) => (
              <li
                className="flex flex-col justify-between gap-5 rounded-2xl border p-5 sm:flex-row sm:items-center"
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
