"use client";

/* eslint-disable shadcn/no-restyle -- Header-dropdown bespoke treatment, shared with AccountMenu + OrganizationSwitcher: same w-64 rounded-xl p-2 content + normal-case items for identical header look. Extract a ui variant post-MVP. */

import { CheckIcon, ChevronDownIcon, PaletteIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

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
   Trigger: outline sm + icon + current label + chevron.
   Content: w-64 rounded-xl p-2 + label + check items (same as AccountMenu).
   All 7 themes from lib/themes, semantic tokens only. */
export function ThemeSwitcher() {
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
            aria-label={`Color theme: ${current?.label ?? "system"}. Switch theme`}
            size="sm"
            variant="outline"
          />
        }
      >
        <PaletteIcon aria-hidden="true" data-icon="inline-start" />
        {current?.label ?? "Theme"}
        <ChevronDownIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl p-2">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Color theme</DropdownMenuLabel>
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
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full bg-primary"
                />
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
