"use client";

import { LoaderCircleIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
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

  return (
    <Button disabled={pending} onClick={signOut} size="sm" variant="ghost">
      {pending ? (
        <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
      ) : (
        <LogOutIcon data-icon="inline-start" />
      )}
      Sign out
    </Button>
  );
}
