"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useRef, type RefObject } from "react";

import { ArchivedActionExplanation } from "@/components/archived-action-explanation";
import { ReasonFieldError } from "@/components/reason-field-error";
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
import { useProjectLifecycleActions } from "@/features/projects/use-project-lifecycle-actions";

export function ProjectLifecycleActions({
  projectId,
  focusAfterArchive,
}: {
  projectId: string;
  /** Surviving element that takes focus once archiving removes the trigger. */
  focusAfterArchive?: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("projects");
  const workflow = useProjectLifecycleActions(projectId, {
    onArchived: () => focusAfterArchive?.current?.focus(),
  });
  const archiveTrigger = useRef<HTMLButtonElement>(null);
  const archiveCancel = useRef<HTMLButtonElement>(null);
  const reopenTrigger = useRef<HTMLButtonElement>(null);
  const reasonError = workflow.form.formState.errors.reason;

  return (
    <>
      <Dialog
        open={workflow.archiveOpen}
        onOpenChange={(open) => {
          if (!open) workflow.cancel();
        }}
      >
        <DialogContent initialFocus={archiveCancel} finalFocus={archiveTrigger}>
          <DialogHeader>
            <DialogTitle>{t("workspace.archiveConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("workspace.archiveConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={archiveCancel}
              type="button"
              variant="outline"
              data-testid="confirm-dialog-cancel"
              disabled={workflow.pending}
              onClick={workflow.cancel}
            >
              {t("create.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-testid="confirm-dialog-execute"
              disabled={workflow.archiveDisabled}
              onClick={() => void workflow.execute()}
            >
              {t("workspace.archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={workflow.reopenOpen}
        onOpenChange={(open) => {
          if (!open) workflow.cancel();
        }}
      >
        <DialogContent finalFocus={reopenTrigger}>
          <DialogHeader>
            <DialogTitle>{t("workspace.reopen")}</DialogTitle>
            <DialogDescription>
              {t("workspace.reopenDescription")}
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="reopen-reason">{t("workspace.reopenReason")}</Label>
          <Textarea
            id="reopen-reason"
            maxLength={2000}
            readOnly={workflow.pending}
            aria-invalid={Boolean(reasonError)}
            aria-describedby={reasonError ? "reopen-reason-error" : undefined}
            {...workflow.form.register("reason", {
              onChange: () => workflow.form.clearErrors("reason"),
              onBlur: () => {
                if (!workflow.form.getValues("reason").trim())
                  workflow.form.setError("reason", {
                    type: "required",
                    message: "reasonInvalid",
                  });
              },
            })}
          />
          {reasonError && (
            <p role="alert" id="reopen-reason-error">
              <ReasonFieldError />
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              disabled={workflow.reopenDisabled}
              data-testid="reopen-project-confirm"
              onClick={() => void workflow.execute()}
            >
              {t("workspace.reopen")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {workflow.settlement && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {workflow.canArchive && (
            <Button
              ref={archiveTrigger}
              data-testid="archive-project"
              disabled={workflow.pending}
              onClick={() => workflow.open("archive")}
              type="button"
              variant="destructive"
            >
              {t("workspace.archive")}
            </Button>
          )}
          {workflow.canReopen && (
            <Button
              ref={reopenTrigger}
              data-testid="reopen-project"
              onClick={() => workflow.open("reopen")}
              type="button"
              variant="outline"
            >
              {t("workspace.reopen")}…
            </Button>
          )}
          {workflow.showArchivedInfo && (
            <ArchivedActionExplanation variant="icon" />
          )}
        </div>
      )}
    </>
  );
}

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
