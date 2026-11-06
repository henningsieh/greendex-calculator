"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import * as React from "react";

import { THEME_VALUES } from "@/lib/themes";

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={[...THEME_VALUES]}
      value={{
        light: "light",
        // System dark resolves to the literal name "dark".
        dark: "theme-erasmus-midnight",
        "theme-erasmus-midnight": "theme-erasmus-midnight",
        "theme-erasmus-violet": "theme-erasmus-violet",
        "theme-erasmus-dark": "theme-erasmus-dark",
        // Removed themes: heal stored user choices to midnight.
        "theme-ember-plum": "theme-erasmus-midnight",
        "theme-ember-royal": "theme-erasmus-midnight",
        // Renamed themes: heal stored pre-rename choices.
        "theme-ember-midnight": "theme-erasmus-midnight",
        "theme-ember-violet": "theme-erasmus-violet",
        "theme-ember-abyss": "theme-erasmus-dark",
      }}
      {...props}
    >
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  );
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme();

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key.toLowerCase() !== "d") {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      setTheme(resolvedTheme === "light" ? "theme-erasmus-midnight" : "light");
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [resolvedTheme, setTheme]);

  return null;
}

export { ThemeProvider };
