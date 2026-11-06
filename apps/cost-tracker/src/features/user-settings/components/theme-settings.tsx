"use client";

import { useTranslations } from "@greendex/i18n/client";
import { KeyboardIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { ThemeSwatch } from "@/components/theme-swatch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { THEMES, isThemeValue } from "@/lib/themes";

const subscribeToHydration = () => () => undefined;

export function ThemeSettings() {
  const t = useTranslations("settings.theme");
  const mounted = React.useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const { setTheme, theme } = useTheme();
  const selectedTheme = mounted && theme && isThemeValue(theme) ? theme : null;

  return (
    <div className="flex flex-col gap-6">
      <FieldSet>
        <FieldLegend variant="label">{t("title")}</FieldLegend>
        <FieldDescription>{t("description")}</FieldDescription>
        <Tabs
          aria-label={t("ariaLabel")}
          value={selectedTheme ?? ""}
          onValueChange={(value) => {
            if (value && isThemeValue(value)) {
              setTheme(value);
            }
          }}
        >
          {/* eslint-disable-next-line shadcn/no-restyle -- segmented theme switch wraps to two rows on narrow screens */}
          <TabsList className="h-auto min-h-10 flex-wrap">
            {THEMES.map((entry) => (
              <TabsTrigger
                key={entry.value}
                aria-label={t("use", { theme: entry.label })}
                value={entry.value}
              >
                <ThemeSwatch value={entry.value} />
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
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
