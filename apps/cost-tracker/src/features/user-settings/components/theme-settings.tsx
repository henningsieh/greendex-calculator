"use client";

import { useTranslations } from "@greendex/i18n/client";
import { KeyboardIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { THEMES, isThemeValue } from "@/lib/themes";

const subscribeToHydration = () => () => undefined;

function themeIcon(value: string) {
  if (value === "light") {
    return <SunIcon data-icon="inline-start" />;
  }

  if (value === "dark") {
    return <MoonIcon data-icon="inline-start" />;
  }

  return <span aria-hidden="true" className="size-3 rounded-full bg-primary" />;
}

export function ThemeSettings() {
  const t = useTranslations("settings.theme");
  const mounted = React.useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const { setTheme, theme } = useTheme();
  const selectedValues = mounted && theme && isThemeValue(theme) ? [theme] : [];

  function changeTheme(values: string[]) {
    changeFullTheme(values.at(-1) ?? null);
  }

  function changeFullTheme(value: string | null) {
    if (value && isThemeValue(value)) {
      setTheme(value);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <FieldSet>
        <FieldLegend variant="label">{t("title")}</FieldLegend>
        <FieldDescription>{t("description")}</FieldDescription>
        <ToggleGroup
          aria-label={t("ariaLabel")}
          className="flex-wrap justify-start"
          disabled={!mounted}
          onValueChange={changeTheme}
          value={selectedValues}
          variant="outline"
        >
          {THEMES.map((entry) => (
            <ToggleGroupItem
              key={entry.value}
              aria-label={t("use", { theme: entry.label })}
              value={entry.value}
            >
              {themeIcon(entry.value)}
              {entry.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FieldSet>

      <Alert variant="accent">
        <KeyboardIcon aria-hidden="true" className="text-primary" />
        <AlertTitle>{t("shortcutTitle")}</AlertTitle>
        <AlertDescription>
          {t("shortcutDescription", { key: "d" })}
        </AlertDescription>
      </Alert>
    </div>
  );
}
