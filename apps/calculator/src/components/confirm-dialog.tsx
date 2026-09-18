"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            variant={isDestructive ? "destructive" : "default"}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface ConfirmDialogState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
}

/**
 * Hook to use a promise-based confirm dialog
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { confirm, ConfirmDialogComponent } = useConfirmDialog();
 *
 *   const handleDelete = async () => {
 *     const confirmed = await confirm({
 *       title: "Delete item?",
 *       description: "This action cannot be undone.",
 *       confirmText: "Delete",
 *       isDestructive: true,
 *     });
 *
 *     if (confirmed) {
 *       // Perform delete
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleDelete}>Delete</button>
 *       <ConfirmDialogComponent />
 *     </>
 *   );
 * }
 * ```
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    isOpen: false,
    options: null,
    resolve: null,
  });

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        options,
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    state.resolve?.(true);
    setState({ isOpen: false, options: null, resolve: null });
  };

  const handleCancel = () => {
    state.resolve?.(false);
    setState({ isOpen: false, options: null, resolve: null });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCancel();
    }
  };

  const ConfirmDialogComponent = () => {
    if (!state.options) {
      return null;
    }

    return (
      <ConfirmDialog
        cancelText={state.options.cancelText}
        confirmText={state.options.confirmText}
        description={state.options.description}
        isDestructive={state.options.isDestructive}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        onOpenChange={handleOpenChange}
        open={state.isOpen}
        title={state.options.title}
      />
    );
  };

  return { confirm, ConfirmDialogComponent };
}
