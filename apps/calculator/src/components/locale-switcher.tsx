"use client";

import { useLocale, useTranslations } from "@greendex/i18n/client";
import { CheckIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getLocaleData } from "@/lib/i18n/locales";
import { usePathname, useRouter } from "@/lib/i18n/routing";
import type { LanguageCode, LocaleData } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const t = useTranslations("app");

  const locales = useMemo(() => getLocaleData(), []);
  const currentLocale = useMemo(
    () => locales.find((entry) => entry.code === locale),
    [locales, locale],
  );

  function handleLocaleChange(newLocale: LocaleData) {
    if (newLocale.code === locale || isPending) {
      return;
    }

    startTransition(() => {
      router.replace(pathname, {
        locale: newLocale.code as LanguageCode,
      });
    });
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          aria-label={`Select language, current: ${currentLocale?.englishName || locale}`}
          className={cn("size-8", className)}
          data-pending={isPending}
          disabled={isPending}
          role="combobox"
          size="icon-xs"
          type="button"
          variant="locale"
        >
          {currentLocale?.Flag && (
            <currentLocale.Flag className="size-6 rounded-sm border-none" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-0">
        <Command>
          <CommandInput placeholder={t("localeSwitcher.searchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("localeSwitcher.noLanguageFound")}</CommandEmpty>
            <CommandGroup>
              {locales.map((entry) => (
                <CommandItem
                  key={entry.code}
                  keywords={[entry.englishName, entry.label, entry.code]}
                  onSelect={() => {
                    setOpen(false);
                    handleLocaleChange(entry);
                  }}
                  value={entry.code}
                >
                  <CheckIcon
                    className={cn(
                      "size-4",
                      currentLocale?.code === entry.code
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className="flex items-center gap-2">
                    {entry.Flag && (
                      <entry.Flag className="h-4 w-6 rounded-sm border border-border/20" />
                    )}
                    <span className="flex flex-col gap-0.5 leading-tight">
                      <span className="text-sm font-semibold">
                        {entry.englishName} | {entry.code}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.label}
                      </span>
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
