"use client";

import { useTranslations } from "@greendex/i18n/client";
import { InfoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ArchivedActionExplanation({
  variant = "link",
}: {
  /**
   * "icon" renders a compact [i] trigger for tight header slots where the
   * full question would break the layout; "link" keeps the text trigger.
   */
  variant?: "link" | "icon";
} = {}) {
  const t = useTranslations("projects.workspace");
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={0}
        closeDelay={120}
        render={
          variant === "icon" ? (
            <Button
              aria-label={t("whyUnavailable")}
              data-testid="archive-explanation-trigger"
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          ) : (
            <Button
              data-testid="archive-explanation-trigger"
              type="button"
              variant="link"
            />
          )
        }
      >
        {variant === "icon" ? (
          <InfoIcon aria-hidden="true" />
        ) : (
          t("whyUnavailable")
        )}
      </PopoverTrigger>
      <PopoverContent data-testid="archive-explanation-content">
        {t("archiveReadOnly")}
      </PopoverContent>
    </Popover>
  );
}
