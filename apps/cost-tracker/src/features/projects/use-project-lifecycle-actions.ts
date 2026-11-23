import { useTranslations } from "@greendex/i18n/client";
import { ORPCError } from "@orpc/client";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createElement, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { toast } from "@/components/ui/toast";
import { invalidatePartnershipProjectData } from "@/features/partnerships/components/invalidate-partnership-data";
import {
  projectLifecycleCapabilities,
  type ProjectAction,
} from "@/features/projects/project-lifecycle";
import { ReopenProjectInputSchema } from "@/features/projects/validation-schemas";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

export function useProjectLifecycleActions(
  projectId: string,
  options: {
    /** Called after a committed archive, once the workspace reflects it. */
    onArchived?: () => void;
  } = {},
) {
  const queryClient = useQueryClient();
  const t = useTranslations("projects.workspace");
  const [confirmation, setConfirmation] = useState<ProjectAction | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const form = useForm({ defaultValues: { reason: "" } });
  const reason = useWatch({ control: form.control, name: "reason" });
  const { data: project } = useSuspenseQuery(
    orpcQuery.projects.get.queryOptions({
      input: { projectId },
      meta: { costTrackerORPC: true },
    }),
  );
  const hosted = project.relationship === "hosted";
  const { canArchive, canReopen, status } = hosted
    ? projectLifecycleCapabilities({
        archived: project.archived,
        statuses: project.partnerOrganizations.map(
          ({ claimStatus }) => claimStatus,
        ),
        canArchive: project.canArchive === true,
        canReopen: project.canReopen,
      })
    : { canArchive: false, canReopen: false, status: null };

  function open(action: ProjectAction) {
    form.reset();
    setConfirmation(action);
  }

  function cancel() {
    if (!saving.current) setConfirmation(null);
  }

  async function refreshProjectState() {
    await Promise.all([
      invalidatePartnershipProjectData(queryClient),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projectPartnerships.listSetupLinks.key({
          type: "query",
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.claims.reviewerAccess.key({ type: "query" }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.participations.listPartnership.key({ type: "query" }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.participations.get.key({ type: "query" }),
      }),
    ]);
  }

  async function execute() {
    if (!confirmation || saving.current) return;
    const archive = confirmation === "archive";
    if (archive ? !canArchive : !canReopen) return;
    const value = form.getValues("reason").trim();
    if (
      !archive &&
      !ReopenProjectInputSchema.shape.reason.safeParse(value).success
    ) {
      form.setError("reason", { type: "validate", message: "reasonInvalid" });
      return;
    }
    saving.current = true;
    setPending(true);
    try {
      if (archive) await orpc.projects.archive({ projectId });
      else await orpc.projects.reopen({ projectId, reason: value });
      setConfirmation(null);
      toast.add({
        title: t(archive ? "archiveFeedback" : "reopenFeedback"),
        type: "success",
      });
      await refreshProjectState();
      // The archive trigger unmounts with capability, so the dialog's own
      // finalFocus target is detached and focus would fall back to body.
      if (archive) options.onArchived?.();
    } catch (error) {
      toast.add({
        title: t(archive ? "archiveError" : "reopenError"),
        description: createElement(ErrorPresentation, { error }),
        type: "error",
      });
      if (
        error instanceof ORPCError &&
        (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
      ) {
        await invalidatePartnershipProjectData(queryClient);
      }
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return {
    archiveOpen: confirmation === "archive",
    reopenOpen: confirmation === "reopen",
    canArchive,
    canReopen,
    status,
    showArchivedInfo: hosted && project.archived && !project.canReopen,
    archiveDisabled: !canArchive || pending,
    reopenDisabled: !canReopen || !reason.trim() || pending,
    pending,
    form,
    open,
    cancel,
    execute,
  };
}
