"use client";

import { useTranslations } from "@greendex/i18n/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Building2Icon, LinkIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { EntityCombobox } from "@/components/entity-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const searchHosted = (search: string) => orpc.projects.searchHosted({ search });
const searchOrganizations = (search: string) =>
  orpc.organizations.search({ search });

function mutationMessage(error: unknown) {
  return getORPCRequestErrorMessage(error).text;
}

/**
 * Manages Partner Organization assignments for Projects hosted by the active
 * Organization and refreshes affected Project data after each successful change.
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
  const [projectId, setProjectId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [feedback, setFeedback] = useState<
    { message: string; status: "success" | "error" } | undefined
  >();

  const invalidateProjectData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projectPartnerships.list.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.listHosted.key({ type: "query" }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.listPartner.key({ type: "query" }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.get.key({ type: "query" }),
      }),
    ]);
  };

  const assignMutation = useMutation({
    mutationFn: () =>
      orpc.projectPartnerships.assign({ projectId, organizationId }),
    onSuccess: async () => {
      setFeedback({
        message: "Project Partnership assigned.",
        status: "success",
      });
      setOrganizationId("");
      await invalidateProjectData();
    },
    onError: (error) => {
      setFeedback({ message: mutationMessage(error), status: "error" });
    },
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => orpc.projectPartnerships.remove({ id }),
    onSuccess: async () => {
      setFeedback({
        message: "Project Partnership removed.",
        status: "success",
      });
      await invalidateProjectData();
    },
    onError: (error) => {
      setFeedback({ message: mutationMessage(error), status: "error" });
    },
  });

  const projectPreload = Array.from(
    new Map(
      partnerships.map(({ projectId: id, projectName: name }) => [
        id,
        { id, name },
      ]),
    ).values(),
  );
  const organizationPreload = Array.from(
    new Map(
      partnerships.map(({ organizationId: id, organizationName: name }) => [
        id,
        { id, name },
      ]),
    ).values(),
  );

  return (
    <section className="mt-10 space-y-8">
      {dialog}
      {canAssign && (
        <Card data-testid="organization-assignment">
          <CardHeader>
            <CardTitle>{t("manager.assignExisting")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                setFeedback(undefined);
                assignMutation.mutate();
              }}
            >
              <div data-testid="hosted-project-picker" className="space-y-2">
                <span className="text-sm font-medium">
                  {t("manager.hostedProject")}
                </span>
                <EntityCombobox
                  label={t("manager.hostedProject")}
                  value={projectId}
                  onChange={setProjectId}
                  search={searchHosted}
                  preload={projectPreload}
                />
              </div>
              <div
                data-testid="partner-organization-picker"
                className="space-y-2"
              >
                <span className="text-sm font-medium">
                  {t("manager.partnerOrganization")}
                </span>
                <EntityCombobox
                  label={t("manager.partnerOrganization")}
                  value={organizationId}
                  onChange={setOrganizationId}
                  search={searchOrganizations}
                  preload={organizationPreload}
                />
              </div>
              <Button
                data-testid="assign-partnership"
                disabled={
                  assignMutation.isPending || !projectId || !organizationId
                }
                type="submit"
              >
                <LinkIcon aria-hidden="true" />
                {assignMutation.isPending
                  ? t("manager.assigning")
                  : t("manager.assign")}
              </Button>
            </form>
            {feedback && (
              <p
                aria-live="polite"
                className="mt-4 text-sm"
                data-testid="partnership-feedback"
                data-state={feedback.status}
              >
                {feedback.message}
              </p>
            )}
          </CardContent>
        </Card>
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
                  <Building2Icon
                    aria-hidden="true"
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
