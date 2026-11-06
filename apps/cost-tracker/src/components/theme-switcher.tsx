"use client";

/* eslint-disable shadcn/no-restyle -- Header-dropdown bespoke treatment, shared with AccountMenu + OrganizationSwitcher: same w-64 rounded-xl p-2 content + normal-case items for identical header look. Extract a ui variant post-MVP. */

import { useTranslations } from "@greendex/i18n/client";
import { CheckIcon, ChevronDownIcon, PaletteIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { ThemeSwatch } from "@/components/theme-swatch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEMES, isThemeValue } from "@/lib/themes";

const subscribeToHydration = () => () => undefined;

/* Header theme switcher — mirrors OrganizationSwitcher 1:1.
   Trigger: icon-only (palette + chevron), label lives in aria-label.
   Content: w-64 rounded-xl p-2 + label + check items (same as AccountMenu).
   All 4 themes from lib/themes; dots preview each theme's swatch. */
export function ThemeSwitcher() {
  const t = useTranslations("shell.themeSwitcher");
  const mounted = React.useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const { setTheme, theme } = useTheme();
  const current =
    mounted && theme && isThemeValue(theme)
      ? (THEMES.find((entry) => entry.value === theme) ?? null)
      : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("ariaLabel", { theme: current?.label ?? t("system") })}
            className="rounded-md"
            size="sm"
            variant="outline"
          />
        }
      >
        <PaletteIcon aria-hidden="true" data-icon="inline-start" />
        <ChevronDownIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl p-2">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
          {THEMES.map((entry) => {
            const active = mounted && theme === entry.value;

            return (
              <DropdownMenuItem
                aria-current={active ? "true" : undefined}
                className="rounded-md text-sm tracking-normal normal-case"
                key={entry.value}
                onClick={() => setTheme(entry.value)}
                title={entry.description}
              >
                <ThemeSwatch value={entry.value} />
                {entry.label}
                {active && <CheckIcon aria-hidden="true" className="ml-auto" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
