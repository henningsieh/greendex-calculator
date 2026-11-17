"use client";

import { useTranslations } from "@greendex/i18n/client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ArchivedActionExplanation() {
  const t = useTranslations("projects.workspace");
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            data-testid="archive-explanation-trigger"
            type="button"
            variant="link"
          />
        }
      >
        {t("whyUnavailable")}
      </PopoverTrigger>
      <PopoverContent data-testid="archive-explanation-content">
        {t("archiveReadOnly")}
      </PopoverContent>
    </Popover>
  );
}
