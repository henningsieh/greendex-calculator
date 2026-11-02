"use client";

import { useTranslations } from "@greendex/i18n/client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/* PendingButton — the single waiting language.
   shadcn Critical Rules: Button has no isPending — compose Spinner +
   disabled + data-disabled instead. Uses the standard disabled Button
   so theme colors apply automatically across all 7 themes. */
function PendingButton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const t = useTranslations("shell");
  return (
    <span className="calm inline-flex" data-disabled="true">
      <Button {...props} disabled data-disabled="true" className={cn(className)}>
        <Spinner data-icon="inline-start" />
        {children ?? t("common.loading")}
      </Button>
    </span>
  );
}

export { PendingButton };
