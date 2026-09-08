"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const result = await authClient.signOut();

    if (result.error) {
      setPending(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return { pending, signOut };
}
