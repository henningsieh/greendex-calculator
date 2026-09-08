"use client";

import { LoaderCircleIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type SignOutButtonProps = {
  className?: string;
  compact?: boolean;
};

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

export function SignOutButton({
  className,
  compact = false,
}: SignOutButtonProps) {
  const { pending, signOut } = useSignOut();

  return (
    <Button
      aria-label={compact ? "Sign out" : undefined}
      className={className ?? (compact ? undefined : "h-11 rounded-none px-4")}
      disabled={pending}
      onClick={signOut}
      size={compact ? "icon-sm" : "sm"}
      variant="ghost"
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
