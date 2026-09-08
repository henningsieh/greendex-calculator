"use client";

import { LoaderCircleIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type SignOutButtonProps = {
  compact?: boolean;
};

export function SignOutButton({ compact = false }: SignOutButtonProps) {
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
    <Button
      aria-label={compact ? "Sign out" : undefined}
      disabled={pending}
      onClick={signOut}
      size={compact ? "icon-sm" : "sm"}
      variant="outline"
    >
      {pending ? (
        <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
      ) : (
        <LogOutIcon data-icon="inline-start" />
      )}
      <span className={compact ? "sr-only" : undefined}>Sign out</span>
    </Button>
  );
}
