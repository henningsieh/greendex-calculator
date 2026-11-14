"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useDateFormat } from "@greendex/i18n/datetime/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { EyeIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { partnershipPath, projectPath } from "@/app/paths";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { EntityIcon } from "@/components/entity-icon";
import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/lib/i18n/routing";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

import { invalidatePartnershipProjectData } from "./invalidate-partnership-data";

export type PartnershipFeedback = {
  message: React.ReactNode;
  status: "success" | "error";
};

function mutationMessage(error: unknown) {
  return <ErrorPresentation error={error} />;
}

/**
 * Project Partnerships grouped by hosted Project.
 * Readers and assigners share exactly this query; creation lives in the
 * page-header dialogs. Each Project gets one card so a Partner Organization
 * is always read in the context of the Project it contributes to.
 */
export function ProjectPartnershipManager({
  canAssign = false,
}: {
  canAssign?: boolean;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("partnerships");
  const dateFormat = useDateFormat();
  const { confirm, dialog } = useConfirmDialog();
  const { data: partnerships } = useSuspenseQuery(
    orpcQuery.projectPartnerships.list.queryOptions({
      meta: { costTrackerORPC: true },
      // A failed refetch must reach the page boundary even when a list is
      // cached: access can be revoked mid-session, and the denial fallback
      // is the only wall this page has.
      throwOnError: true,
    }),
  );
  const [feedback, setFeedback] = useState<PartnershipFeedback | undefined>();
  const [filter, setFilter] = useState("");
  const deferredFilter = useDeferredValue(filter.trim().toLowerCase());

  const removeMutation = useMutation({
    mutationFn: (id: string) => orpc.projectPartnerships.remove({ id }),
    onSuccess: async () => {
      setFeedback({
        message: t("manager.removed"),
        status: "success",
      });
      await invalidatePartnershipProjectData(queryClient);
    },
    onError: (error) => {
      setFeedback({ message: mutationMessage(error), status: "error" });
    },
  });

  const projectCount = useMemo(
    () => new Set(partnerships.map((item) => item.projectId)).size,
    [partnerships],
  );

  const groups = useMemo(() => {
    const visible = deferredFilter
      ? partnerships.filter(
          (item) =>
            item.organizationName.toLowerCase().includes(deferredFilter) ||
            item.projectName.toLowerCase().includes(deferredFilter),
        )
      : partnerships;
    const byProject = new Map<
      string,
      {
        projectId: string;
        projectName: string;
        items: typeof visible;
      }
    >();
    for (const item of visible) {
      const group = byProject.get(item.projectId);
      if (group) group.items.push(item);
      else
        byProject.set(item.projectId, {
          projectId: item.projectId,
          projectName: item.projectName,
          items: [item],
        });
    }
    return [...byProject.values()].sort((a, b) =>
      a.projectName.localeCompare(b.projectName),
    );
  }, [partnerships, deferredFilter]);

  return (
    <section aria-label={t("manager.current")} className="mt-10 space-y-4">
      {dialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl">{t("manager.current")}</h2>
          {partnerships.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("manager.summary", {
                partnershipCount: partnerships.length,
                projectCount,
              })}
            </p>
          )}
        </div>
        {partnerships.length > 0 && (
          <div className="grid gap-2">
            <Label className="sr-only" htmlFor="partnership-filter">
              {t("manager.searchLabel")}
            </Label>
            <div className="relative">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                /* eslint-disable-next-line shadcn/no-restyle -- Search icon overlay requires matching input inset. */
                className="w-full pl-9 sm:w-64"
                id="partnership-filter"
                onChange={(event) => setFilter(event.target.value)}
                placeholder={t("manager.searchPlaceholder")}
                type="search"
                value={filter}
              />
            </div>
          </div>
        )}
      </div>
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
      {partnerships.length === 0 ? (
        <p
          data-testid="partnerships-empty"
          className="rounded-2xl border p-8 text-center text-muted-foreground"
        >
          {t("manager.none")}
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-2xl border p-8 text-center text-muted-foreground">
          {t("manager.emptySearch")}
        </p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <li key={group.projectId}>
              <Card>
                <CardHeader>
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"
                    >
                      <EntityIcon
                        entity="project"
                        className="size-5 text-muted-foreground"
                      />
                    </span>
                    <CardTitle as="h3" className="min-w-0">
                      <Link
                        className="block truncate hover:underline"
                        href={projectPath(group.projectId)}
                        prefetch={false}
                      >
                        {group.projectName}
                      </Link>
                    </CardTitle>
                  </div>
                  <CardAction>
                    <Badge variant="ember-pill">
                      {t("manager.partnersCount", {
                        count: group.items.length,
                      })}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border">
                    {group.items.map((partnership) => (
                      <li
                        className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                        data-testid={`partnership-row-${partnership.organizationId}`}
                        key={partnership.id}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {partnership.organizationName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t("manager.since", {
                              date: dateFormat.format(
                                partnership.assignedAt,
                                "date.medium",
                              ),
                            })}
                          </p>
                        </div>
                        <Link
                          className={buttonVariants({
                            variant: "link",
                            size: "sm",
                          })}
                          href={partnershipPath(partnership.id)}
                          prefetch={false}
                        >
                          <EyeIcon aria-hidden="true" />
                          {t("manager.viewDetails")}
                        </Link>
                        {canAssign && (
                          <Button
                            disabled={removeMutation.isPending}
                            data-testid={`remove-partnership-${partnership.id}`}
                            onClick={async () => {
                              if (
                                await confirm({
                                  title: t(
                                    "confirmations.removePartnership.title",
                                  ),
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
                            size="sm"
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
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
