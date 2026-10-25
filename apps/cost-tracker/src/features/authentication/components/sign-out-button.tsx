"use client";

import { LoaderCircleIcon, LogOutIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { useSignOut } from "@/features/authentication/hooks/use-sign-out";

type ButtonClickEvent = Parameters<
  NonNullable<ComponentProps<typeof Button>["onClick"]>
>[0];

type SignOutButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "disabled" | "className" | "style"
> & {
  compact?: boolean;
};

export function SignOutButton({
  compact = false,
  size = "default",
  variant = "ghost",
  ...props
}: SignOutButtonProps) {
  const { pending, signOut: signOutAction } = useSignOut();

  function signOut(event: ButtonClickEvent) {
    void signOutAction();
    props.onClick?.(event);
  }

  return (
    <Button
      {...props}
      data-testid="sign-out"
      aria-label={compact ? "Sign out" : undefined}
      disabled={pending}
      onClick={signOut}
      size={compact ? "icon-sm" : size}
      variant={variant}
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
