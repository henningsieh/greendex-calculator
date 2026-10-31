"use client";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { useTranslations } from "@greendex/i18n/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

export function PartnerCoordinatorControls({
  partnershipId,
}: {
  partnershipId: string;
}) {
  const t = useTranslations("participations");
  const { confirm, dialog } = useConfirmDialog();
  const queryClient = useQueryClient();
  const [targetUserId, setTargetUserId] = useState("");
  const [feedback, setFeedback] = useState<React.ReactNode>("");
  // This existing read is owner/admin-only; the mutations separately enforce
  // that the active Organization is this Project Partnership's Partner side.
  const members = useQuery(
    orpcQuery.organizations.listMembers.queryOptions({
      input: {},
      meta: { costTrackerORPC: true },
      retry: false,
    }),
  );
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.listPartner.key({ type: "query" }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.scopes.key({ type: "query" }),
      }),
    ]);
  };
  const onError = (error: unknown) =>
    setFeedback(<ErrorPresentation error={error} />);
  const assign = useMutation({
    mutationFn: () =>
      orpc.projectPartnerships.assignPartnerCoordinator({
        partnershipId,
        userId: targetUserId,
      }),
    onSuccess: async () => {
      setFeedback("Group Organizer assigned to this Project Partnership.");
      await refresh();
    },
    onError,
  });
  const revoke = useMutation({
    mutationFn: () =>
      orpc.projectPartnerships.removePartnerCoordinator({
        partnershipId,
        userId: targetUserId,
      }),
    onSuccess: async () => {
      setFeedback(
        "Group Organizer assignment revoked for this Project Partnership. Organization Membership roles are unchanged.",
      );
      await refresh();
    },
    onError,
  });
  if (members.isPending)
    return <output>{t("groupOrganizer.loadingUsers")}</output>;
  if (members.isError)
    return (
      <Alert>
        <AlertTitle>{t("groupOrganizer.unavailable")}</AlertTitle>
        <AlertDescription>
          {<ErrorPresentation error={members.error} />}
        </AlertDescription>
        <Button
          type="button"
          variant="outline"
          onClick={() => void members.refetch()}
        >
          {t("groupOrganizer.retryUsers")}
        </Button>
      </Alert>
    );
  const eligible = members.data.members.filter((entry) =>
    entry.role
      .split(",")
      .some((role) =>
        [
          ORGANIZATION_ROLES.OrganizationOwner,
          ORGANIZATION_ROLES.OrganizationAdmin,
          ORGANIZATION_ROLES.ProjectCoordinator,
        ].some((knownRole) => knownRole === role.trim()),
      ),
  );
  return (
    <div className="space-y-4">
      {dialog}
      <p className="text-sm text-muted-foreground">
        {t("groupOrganizer.description")}
      </p>
      <div className="space-y-2">
        <Label htmlFor={`group-organizer-${partnershipId}`}>
          {t("groupOrganizer.registeredUserLabel")}
        </Label>
        <select
          id={`group-organizer-${partnershipId}`}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={targetUserId}
          disabled={assign.isPending || revoke.isPending}
          onChange={(event) => {
            setTargetUserId(event.target.value);
            setFeedback("");
          }}
        >
          <option value="">{t("groupOrganizer.selectUser")}</option>
          {eligible.map((entry) => (
            <option key={entry.userId} value={entry.userId}>
              {entry.name} ({entry.email})
            </option>
          ))}
        </select>
      </div>
      {eligible.length === 0 && <p>{t("groupOrganizer.noEligible")}</p>}
      <div className="flex flex-wrap gap-3">
        <Button
          data-testid="assign-group-organizer"
          type="button"
          disabled={!targetUserId || assign.isPending || revoke.isPending}
          onClick={() => {
            setFeedback("");
            assign.mutate();
          }}
        >
          {t("groupOrganizer.assign")}
        </Button>
        <Button
          data-testid="revoke-group-organizer"
          type="button"
          variant="outline"
          disabled={!targetUserId || assign.isPending || revoke.isPending}
          onClick={async () => {
            if (
              await confirm({
                title: t("confirmations.revokeOrganizer.title"),
                description: t("confirmations.revokeOrganizer.description", {
                  user:
                    eligible.find((entry) => entry.userId === targetUserId)
                      ?.name ?? targetUserId,
                }),
                confirmText: t("confirmations.revokeOrganizer.execute"),
                isDestructive: true,
              })
            ) {
              setFeedback("");
              revoke.mutate();
            }
          }}
        >
          {revoke.isPending
            ? t("confirmations.pending")
            : t("groupOrganizer.revoke")}
        </Button>
      </div>
      {feedback && (
        <Alert>
          <AlertTitle>{t("groupOrganizer.update")}</AlertTitle>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
