"use client";

import { useTranslations } from "@greendex/i18n/client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/* PendingButton — the single waiting language (ember-c-spec.md, LOCKED).
   shadcn Critical Rules: Button has no isPending — compose Spinner +
   disabled + data-disabled instead. The locked Sweep-band + dots were
   replaced by the Spinner (priority: shadcn-Standard > gelockter Look);
   color-mix 45% fire, calm cell, and no-opacity rules are kept. */
function PendingButton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const t = useTranslations("shell");
  return (
    <span className="calm inline-flex" data-disabled="true">
      <Button
        {...props}
        variant="pending"
        disabled
        data-disabled="true"
        className={cn(className)}
      >
        <Spinner data-icon="inline-start" />
        {children ?? t("common.loading")}
      </Button>
    </span>
  );
}

export { PendingButton };
