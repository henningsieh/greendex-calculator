"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { toast } from "@/components/ui/toast";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc } from "@/lib/orpc/orpc";

export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await orpc.authentication.signOut();
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.add({
        description: getORPCRequestErrorMessage(error).text,
        title: "Could not sign out",
        type: "error",
      });
    } finally {
      setPending(false);
    }
  }

  return { pending, signOut };
}
