"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Building2Icon, LinkIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function mutationMessage(error: unknown) {
  return getORPCRequestErrorMessage(error).text;
}

export function ProjectPartnershipManager() {
  const queryClient = useQueryClient();
  const { data: partnerships } = useSuspenseQuery(
    orpcQuery.projectPartnerships.list.queryOptions({
      meta: { costTrackerORPC: true },
    }),
  );
  const [projectId, setProjectId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [feedback, setFeedback] = useState<string>();

  const invalidateProjectData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projectPartnerships.list.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.hostedOverview.key({ type: "query" }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.partnerOverview.key({ type: "query" }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.detail.key({ type: "query" }),
      }),
    ]);
  };

  const assignMutation = useMutation({
    mutationFn: () =>
      orpc.projectPartnerships.assign({ projectId, organizationId }),
    onSuccess: async () => {
      setFeedback("Project Partnership assigned.");
      setOrganizationId("");
      await invalidateProjectData();
    },
    onError: (error) => setFeedback(mutationMessage(error)),
  });
  const removeMutation = useMutation({
    mutationFn: (partnershipId: string) =>
      orpc.projectPartnerships.remove({ partnershipId }),
    onSuccess: async () => {
      setFeedback("Project Partnership removed.");
      await invalidateProjectData();
    },
    onError: (error) => setFeedback(mutationMessage(error)),
  });

  return (
    <section className="mt-10 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Assign an existing Organization</CardTitle>
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
            <div className="space-y-2">
              <Label htmlFor="partnership-project-id">Hosted Project ID</Label>
              <Input
                id="partnership-project-id"
                onChange={(event) => setProjectId(event.target.value)}
                required
                value={projectId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partnership-organization-id">
                Partner Organization ID
              </Label>
              <Input
                id="partnership-organization-id"
                onChange={(event) => setOrganizationId(event.target.value)}
                required
                value={organizationId}
              />
            </div>
            <Button disabled={assignMutation.isPending} type="submit">
              <LinkIcon aria-hidden="true" />
              {assignMutation.isPending ? "Assigning…" : "Assign"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Enter an exact existing Organization ID. Organization directory search
            is not exposed until its disclosure policy is defined.
          </p>
          {feedback && (
            <p aria-live="polite" className="mt-4 text-sm">
              {feedback}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="font-heading text-2xl font-semibold">
          Current Project Partnerships
        </h2>
        {partnerships.length === 0 ? (
          <p className="rounded-xl border p-8 text-center text-muted-foreground">
            No Partner Organizations are assigned to hosted Projects.
          </p>
        ) : (
          <ul className="grid gap-4">
            {partnerships.map((partnership) => (
              <li
                className="flex flex-col justify-between gap-5 rounded-xl border p-5 sm:flex-row sm:items-center"
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
                      Assigned {dateTimeFormatter.format(partnership.assignedAt)}{" "}
                      · Updated {dateTimeFormatter.format(partnership.updatedAt)}
                    </p>
                  </div>
                </div>
                <Button
                  disabled={removeMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${partnership.organizationName} from ${partnership.projectName}?`,
                      )
                    ) {
                      setFeedback(undefined);
                      removeMutation.mutate(partnership.id);
                    }
                  }}
                  type="button"
                  variant="destructive"
                >
                  <Trash2Icon aria-hidden="true" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
