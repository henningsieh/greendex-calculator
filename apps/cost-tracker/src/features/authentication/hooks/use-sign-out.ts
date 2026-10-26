"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { toast } from "@/components/ui/toast";
import { orpc } from "@/lib/orpc/orpc";

export function useSignOut(destination = "/") {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const [pending, setPending] = useState(false);

  async function signOut() {
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

  return { pending, signOut };
}
