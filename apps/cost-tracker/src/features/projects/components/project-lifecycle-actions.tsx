"use client";

import { useTranslations } from "@greendex/i18n/client";
import { ORPCError } from "@orpc/client";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ArchivedActionExplanation } from "@/components/archived-action-explanation";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { canCompleteProject } from "@/features/claims/claim-lifecycle";
import { invalidatePartnershipProjectData } from "@/features/partnerships/components/invalidate-partnership-data";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

/**
 * Project lifecycle actions: archive / reopen plus the archived-state
 * explanation. Self-sufficient — it reads the Project from the shared query
 * cache, computes eligibility, and owns its dialogs, confirmations,
 * mutations and feedback — so a page header only hands it over:
 *
 *   <ProtectedPageHeader
 *     …
 *     rightButton={<ProjectLifecycleActions projectId={projectId} />}
 *   />
 *
 * Partnership setup dialogs are not lifecycle: they live with the
 * partnership list they affect (AssignedPartnersCard toolbar).
 */
export function ProjectLifecycleActions({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("projects.workspace");
  const [completing, setCompleting] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { confirm, dialog } = useConfirmDialog();
  const { data: project } = useSuspenseQuery(
    orpcQuery.projects.get.queryOptions({
      input: { projectId },
      meta: { costTrackerORPC: true },
    }),
  );

  const isHosted = project.relationship === "hosted";
  const canComplete =
    isHosted &&
    project.canArchive === true &&
    !project.archived &&
    canCompleteProject(
      project.partnerOrganizations.map(({ claimStatus }) => claimStatus),
    );
  const canReopen = isHosted && project.archived && project.canReopen;
  // The [i] explanation shows only when the reopen button is missing:
  // an archived project the viewer may not reopen gets the reason,
  // anyone with the button gets the reason dialog behind it instead.
  const showArchivedInfo = isHosted && project.archived && !project.canReopen;

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

  async function completeProject() {
    if (completing) return;
    if (
      !(await confirm({
        title: t("archiveConfirmTitle"),
        description: t("archiveConfirmDescription"),
        confirmText: t("archive"),
        isDestructive: true,
      }))
    )
      return;
    setCompleting(true);
    try {
      await orpc.projects.archive({ projectId });
      toast.add({ title: t("archiveFeedback"), type: "success" });
      await refreshProjectState();
    } catch (error) {
      if (
        error instanceof ORPCError &&
        (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
      ) {
        await invalidatePartnershipProjectData(queryClient);
      }
      toast.add({
        title: t("archiveError"),
        description: <ErrorPresentation error={error} />,
        type: "error",
      });
    } finally {
      setCompleting(false);
    }
  }

  async function reopenProject() {
    if (!canReopen || completing || !reason.trim()) return;
    setCompleting(true);
    try {
      await orpc.projects.reopen({ projectId, reason });
      setReopenOpen(false);
      setReason("");
      toast.add({ title: t("reopenFeedback"), type: "success" });
      await refreshProjectState();
    } catch (error) {
      if (
        error instanceof ORPCError &&
        (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
      ) {
        await invalidatePartnershipProjectData(queryClient);
      }
      toast.add({
        title: t("reopenError"),
        description: <ErrorPresentation error={error} />,
        type: "error",
      });
    } finally {
      setCompleting(false);
    }
  }

  // Feedback outlives the buttons: after archiving, no action qualifies
  // anymore, but the confirmation must stay visible.
  return (
    <>
      {dialog}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reopen")}</DialogTitle>
            <DialogDescription>{t("reopenDescription")}</DialogDescription>
          </DialogHeader>
          <Label htmlFor="reopen-reason">{t("reopenReason")}</Label>
          <Textarea
            id="reopen-reason"
            value={reason}
            maxLength={2000}
            onChange={(event) => setReason(event.target.value)}
          />
          <DialogFooter>
            <Button
              type="button"
              disabled={!canReopen || !reason.trim() || completing}
              data-testid="reopen-project-confirm"
              onClick={reopenProject}
            >
              {t("reopen")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {(canComplete || canReopen || showArchivedInfo) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canComplete ? (
            <Button
              data-testid="archive-project"
              disabled={completing}
              onClick={completeProject}
              type="button"
              variant="destructive"
            >
              {completing ? t("archiving") : t("archive")}
            </Button>
          ) : null}
          {canReopen ? (
            <Button
              data-testid="reopen-project"
              onClick={() => setReopenOpen(true)}
              type="button"
              variant="outline"
            >
              {t("reopen")}…
            </Button>
          ) : null}
          {showArchivedInfo ? <ArchivedActionExplanation variant="icon" /> : null}
        </div>
      )}
    </>
  );
}

/**
 * Loading placeholder for headers that render before the Project resolves.
 * Two pulsing button-sized blocks; static under reduced motion.
 */
export function ProjectLifecycleActionsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <span className="h-10 w-44 rounded-xl bg-muted motion-safe:animate-pulse" />
      <span className="h-10 w-44 rounded-xl bg-muted motion-safe:animate-pulse" />
    </div>
  );
}
