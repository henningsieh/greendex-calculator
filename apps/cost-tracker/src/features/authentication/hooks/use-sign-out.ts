"use client";

import { useTranslations } from "@greendex/i18n/client";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, type RefObject } from "react";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { orpc } from "@/lib/orpc/orpc";

export function useSignOut(
  destination: Route = "/",
  finalFocus?: RefObject<HTMLElement | null>,
) {
  const { confirm, dialog } = useConfirmDialog(finalFocus);
  const router = useRouter();
  const t = useTranslations("onboarding");
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (
      pending ||
      !(await confirm({
        title: t("auth.confirmSignOut.title"),
        description: t("auth.confirmSignOut.description"),
        confirmText: t("auth.signOut"),
      }))
    )
      return;
    setPending(true);
    try {
      await orpc.authentication.signOut();
      router.replace(destination);
    } catch {
      toast.add({
        description: t("error.request"),
        title: t("error.signOut"),
        type: "error",
      });
    } finally {
      setPending(false);
    }
  }

  return { pending, signOut, dialog };
}
