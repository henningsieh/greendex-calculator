"use client";

import { useTranslations } from "@greendex/i18n/client";
import type { ComponentPropsWithoutRef } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LastUsedBadgeProps extends ComponentPropsWithoutRef<typeof Badge> {
  label?: string;
}

export function LastUsedBadge({
  variant = "secondary",
  className,
  ...props
}: LastUsedBadgeProps) {
  const t = useTranslations("authentication.login");

  if (props.label === undefined) {
    props.label = t("lastUsed");
  }
  const label = props.label;

  return (
    <Badge
      className={cn(
        /* eslint-disable-next-line shadcn/no-restyle -- Last-used status intentionally has its own secondary treatment. */
        "absolute self-center border border-secondary bg-secondary/50 text-secondary-foreground",
        className,
      )}
      variant={variant}
      {...props}
    >
      {label}
    </Badge>
  );
}
