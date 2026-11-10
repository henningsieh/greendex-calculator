"use client";

import { useTranslations } from "@greendex/i18n/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { LinkIcon } from "lucide-react";
import { useState } from "react";

import { EntityCombobox } from "@/components/entity-combobox";
import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

import { invalidatePartnershipProjectData } from "./invalidate-partnership-data";

const searchHosted = (search: string) => orpc.projects.searchHosted({ search });
const searchOrganizations = (search: string) =>
  orpc.organizations.search({ search });

export type PartnershipFeedback = {
  message: React.ReactNode;
  status: "success" | "error";
};

/**
 * Assignment form for Partner Organizations. Only mounted for viewers who may
 * assign, so the hosted-project options query below runs exactly when the
 * form exists — never for viewers who only read the partnership list.
 * The preload shows the first 20 newest hosted projects; typing in the
 * picker searches the full table.
 */
export function ProjectPartnershipAssigner({
  partnerships,
  feedback,
  onFeedback,
}: {
  partnerships: { organizationId: string; organizationName: string }[];
  feedback: PartnershipFeedback | undefined;
  onFeedback: (feedback: PartnershipFeedback | undefined) => void;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("partnerships");
  const { data: hostedProjects } = useSuspenseQuery(
    orpcQuery.projects.searchHosted.queryOptions({
      input: { search: "" },
      meta: { costTrackerORPC: true },
    }),
  );
  const [projectId, setProjectId] = useState("");
  const [organizationId, setOrganizationId] = useState("");

  const assignMutation = useMutation({
    mutationFn: () =>
      orpc.projectPartnerships.assign({ projectId, organizationId }),
    onSuccess: async () => {
      onFeedback({
        message: "Project Partnership assigned.",
        status: "success",
      });
      setOrganizationId("");
      await invalidatePartnershipProjectData(queryClient);
    },
    onError: (error) => {
      onFeedback({
        message: <ErrorPresentation error={error} />,
        status: "error",
      });
    },
  });

  const projectPreload = Array.from(
    new Map(hostedProjects.map(({ id, name }) => [id, { id, name }])).values(),
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
    <Card data-testid="organization-assignment">
      <CardHeader>
        <CardTitle>{t("manager.assignExisting")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            onFeedback(undefined);
            assignMutation.mutate();
          }}
        >
          <div data-testid="hosted-project-picker" className="grid gap-2">
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
          <div data-testid="partner-organization-picker" className="grid gap-2">
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
            disabled={assignMutation.isPending || !projectId || !organizationId}
            type="submit"
          >
            <LinkIcon aria-hidden="true" />
            {assignMutation.isPending
              ? t("manager.assigning")
              : t("manager.assign")}
          </Button>
        </form>
        {feedback && (
          <div
            aria-live="polite"
            className="mt-4 text-sm"
            data-testid="partnership-feedback"
            data-state={feedback.status}
          >
            {feedback.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
