"use client";

import { useTranslations } from "@greendex/i18n/client";
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
  destination?: string;
};

export function SignOutButton({
  compact = false,
  destination,
  size = "default",
  variant = "ghost",
  ...props
}: SignOutButtonProps) {
  const { pending, signOut: signOutAction, dialog } = useSignOut(destination);
  const t = useTranslations("onboarding");

  function signOut(event: ButtonClickEvent) {
    void signOutAction();
    props.onClick?.(event);
  }

  return (
    <>
      {dialog}
      <Button
        {...props}
        data-testid="sign-out"
        aria-label={compact ? t("auth.signOut") : undefined}
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
        <span className={compact ? "sr-only" : undefined}>
          {t("auth.signOut")}
        </span>
      </Button>
    </>
  );
}
