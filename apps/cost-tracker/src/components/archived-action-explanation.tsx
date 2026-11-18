"use client";

import { useTranslations } from "@greendex/i18n/client";
import { InfoIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  // Hover opens immediately (with a grace delay on leave so the pointer can
  // travel into the content). Click and Enter keep working through the
  // popover's own toggle handling; focus alone only shows the focus ring.
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  function openNow() {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function scheduleClose() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
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
      <PopoverContent
        data-testid="archive-explanation-content"
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
      >
        {t("archiveReadOnly")}
      </PopoverContent>
    </Popover>
  );
}
