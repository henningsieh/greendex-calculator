"use client";

import { useLocale, useTranslations } from "@greendex/i18n/client";
import { CheckIcon, ChevronDownIcon, GlobeIcon } from "lucide-react";
import { useMemo, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLanguageOptions } from "@/lib/i18n/languages";
import { usePathname, useRouter } from "@/lib/i18n/routing";
import type { LanguageCode } from "@/lib/i18n/types";

const languages = getLanguageOptions();

/** Reuse `path?query#hash` so changing language never drops navigation state. */
function currentHref(pathname: string) {
  if (typeof window === "undefined") return pathname;

  return `${pathname}${window.location.search}${window.location.hash}`;
}

/**
 * Header language picker. Mirrors the theme switcher's trigger and menu
 * anatomy while presenting every configured language with its own flag and
 * endonym. Safe to place in any shell or landing navigation.
 */
export function LanguageSelector() {
  const t = useTranslations("shell.languageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const current = languages.find((language) => language.code === locale);
  const CurrentFlag = current?.Flag ?? GlobeIcon;
  const languageNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: "language" }),
    [locale],
  );
  const regionNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: "region" }),
    [locale],
  );

  function secondaryLabel(language: (typeof languages)[number]) {
    const languageName = languageNames.of(language.code) ?? language.label;
    const regionName =
      regionNames.of(language.countryCode) ?? language.displayRegion;
    return `${languageName} · ${regionName}`;
  }

  function changeLanguage(code: LanguageCode) {
    if (code === locale || isPending) return;

    startTransition(() => {
      router.replace(currentHref(pathname), { locale: code });
    });
  }

  return (
    <>
      <output className="sr-only">{isPending ? t("changing") : ""}</output>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-busy={isPending}
              aria-label={t("ariaLabel", {
                language: current?.nativeName ?? locale,
              })}
              data-pending={isPending || undefined}
              data-testid="language-selector-trigger"
              disabled={isPending}
              size="sm"
              variant="ghost"
            />
          }
        >
          <CurrentFlag
            aria-hidden="true"
            className="size-4 rounded-xs ring-1 ring-foreground/15"
            data-icon="inline-start"
          />
          <ChevronDownIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block">{t("label")}</span>
              <span className="mt-1 block text-xs font-normal tracking-normal text-muted-foreground normal-case">
                {t("description")}
              </span>
            </DropdownMenuLabel>
            {languages.map((language) => {
              const active = language.code === locale;
              const Flag = language.Flag ?? GlobeIcon;

              return (
                <DropdownMenuItem
                  aria-current={active ? "true" : undefined}
                  data-language={language.code}
                  disabled={isPending}
                  key={language.code}
                  onClick={() => changeLanguage(language.code)}
                >
                  <Flag
                    aria-hidden="true"
                    className="h-3.5 w-5 shrink-0 rounded-xs ring-1 ring-foreground/15"
                  />
                  <span className="flex min-w-0 flex-col items-start leading-tight">
                    <span className="truncate">{language.nativeName}</span>
                    <span className="truncate text-xs font-normal tracking-normal text-muted-foreground normal-case">
                      {secondaryLabel(language)}
                    </span>
                  </span>
                  {active && <CheckIcon aria-hidden="true" className="ml-auto" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
