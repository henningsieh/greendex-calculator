"use client";

import { useTranslations } from "@greendex/i18n/client";
import { KeyboardIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { ThemeSwatch } from "@/components/theme-swatch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  const titleId = React.useId();
  const selectedTheme = mounted && theme && isThemeValue(theme) ? theme : null;

  const themeTriggers = THEMES.map((entry) => (
    <TabsTrigger
      aria-label={t("use", { theme: entry.label })}
      key={entry.value}
      value={entry.value}
    >
      <ThemeSwatch value={entry.value} />
      {entry.label}
    </TabsTrigger>
  ));

  const handleThemeChange = (value: string) => {
    if (value && isThemeValue(value)) {
      setTheme(value);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={titleId} className="flex flex-col gap-6">
        <h2 className="mb-3 type-ember-eyebrow" id={titleId}>
          {t("title")}
        </h2>
        <p className="text-left text-sm/normal leading-normal font-normal tracking-normal text-muted-foreground normal-case last:mt-0 nth-last-2:-mt-1 [&>a]:link-prose">
          {t("description")}
        </p>
        <Tabs
          aria-label={t("ariaLabel")}
          className="max-sm:hidden"
          orientation="horizontal"
          value={selectedTheme ?? ""}
          onValueChange={handleThemeChange}
        >
          <TabsList>{themeTriggers}</TabsList>
        </Tabs>
        <Tabs
          aria-label={t("ariaLabel")}
          className="sm:hidden"
          orientation="vertical"
          value={selectedTheme ?? ""}
          onValueChange={handleThemeChange}
        >
          <TabsList>{themeTriggers}</TabsList>
        </Tabs>
      </section>

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
