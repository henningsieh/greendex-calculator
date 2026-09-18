"use client";

import { SUPPORTED_LANGUAGES } from "@greendex/config/languages";
import { CheckIcon, ChevronDownIcon, GlobeIcon } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getFlagComponent } from "@/lib/i18n";
import { buildLocalizedPath } from "@/lib/navigation";
import type { LanguageCode } from "@/lib/types";

/**
 * Inline Language Toggle for Navbar
 */
export function LanguageToggleInline() {
  const params = useParams();
  const pathname = usePathname();

  const currentLang = (params?.lang as LanguageCode) || "en";
  const currentLocale = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang);

  const CurrentFlag = currentLocale ? getFlagComponent(currentLocale) : GlobeIcon;
  const currentHasCountryCode = currentLocale && "countryCode" in currentLocale;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors outline-none hover:bg-fd-accent"
        >
          {currentHasCountryCode ? (
            <CurrentFlag className="h-3.5 w-5 rounded-sm shadow-sm" />
          ) : (
            <GlobeIcon className="size-4" />
          )}
          <span className="text-sm font-medium">
            {currentLocale?.code.toUpperCase()}
          </span>
          <ChevronDownIcon className="size-4 opacity-70" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-50">
        {SUPPORTED_LANGUAGES.map((locale) => {
          const FlagIcon = getFlagComponent(locale);
          const isActive = locale.code === currentLang;
          const hasCountryCode = "countryCode" in locale;
          const href = buildLocalizedPath(locale.code, pathname);

          return (
            <DropdownMenuItem key={locale.code} asChild>
              <Link
                href={href}
                className="flex cursor-pointer items-center gap-3"
              >
                {hasCountryCode ? (
                  <FlagIcon className="h-3.5 w-5 rounded-sm shadow-sm" />
                ) : (
                  <GlobeIcon className="size-4" />
                )}
                <div className="flex flex-1 flex-col items-start">
                  <span className={isActive ? "font-medium" : ""}>
                    {locale.label}
                  </span>
                  {locale.displayRegion && (
                    <span className="text-xs opacity-70">
                      {locale.displayRegion}
                    </span>
                  )}
                </div>
                {isActive && <CheckIcon className="size-4" />}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
