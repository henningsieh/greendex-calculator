"use client";

import { useTranslations } from "@greendex/i18n/client";
import { XIcon } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  closeText?: string;
  isDestructive?: boolean;
}

interface ConfirmRequest {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

export function ConfirmDialog({
  options,
  open,
  onResolve,
  finalFocus,
}: {
  options: ConfirmOptions;
  open: boolean;
  onResolve: (confirmed: boolean) => void;
  finalFocus?: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("confirmDialog");
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onResolve(false);
      }}
    >
      <DialogContent
        initialFocus={cancel}
        finalFocus={finalFocus}
        showCloseButton={false}
      >
        <DialogClose
          data-testid="confirm-dialog-close"
          render={
            <Button
              variant="secondary"
              size="icon-sm"
              className="absolute top-5 right-5"
              aria-label={options.closeText ?? t("close")}
            />
          }
        >
          <XIcon />
        </DialogClose>
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          <DialogDescription>{options.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            data-testid="confirm-dialog-cancel"
            render={<Button ref={cancel} variant="outline" />}
          >
            {options.cancelText ?? t("cancel")}
          </DialogClose>
          <Button
            data-testid="confirm-dialog-execute"
            variant={options.isDestructive ? "destructive" : "default"}
            onClick={() => onResolve(true)}
          >
            {options.confirmText ?? t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Render `dialog` beside the trigger and await `confirm(options)` before mutating.
 * Dismissal, concurrent requests, and unmount resolve false. Labels default to
 * translated Confirm, Cancel, and Close. Override action-specific execute copy.
 */
export function useConfirmDialog(finalFocus?: RefObject<HTMLElement | null>) {
  const pending = useRef<ConfirmRequest | null>(null);
  const [state, setState] = useState<{
    options: ConfirmOptions;
    open: boolean;
  } | null>(null);

  useEffect(
    () => () => {
      pending.current?.resolve(false);
      pending.current = null;
    },
    [],
  );

  function confirm(options: ConfirmOptions): Promise<boolean> {
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      pending.current = { options, resolve };
      setState({ options, open: true });
    });
  }

  function settle(confirmed: boolean) {
    const request = pending.current;
    if (!request) return;
    pending.current = null;
    // Commit the closed dialog before the caller starts its mutation.
    flushSync(() => setState({ options: request.options, open: false }));
    request.resolve(confirmed);
  }

  return {
    confirm,
    dialog: state && (
      <ConfirmDialog {...state} onResolve={settle} finalFocus={finalFocus} />
    ),
  };
}
