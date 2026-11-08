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
        light: "theme-erasmus-light",
        // System dark resolves to the literal name "dark".
        dark: "theme-erasmus-dark",
        // Identity entries are required: with `value` present next-themes
        // applies `value[name]` with no fallback, so unlisted themes would
        // lose their <html> class entirely.
        "theme-erasmus-light": "theme-erasmus-light",
        "theme-erasmus-dark": "theme-erasmus-dark",
        "theme-erasmus-midnight": "theme-erasmus-midnight",
        "theme-erasmus-violet": "theme-erasmus-violet",
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

      // An explicitly chosen light theme resolves to its own name, not "light".
      const isLight =
        resolvedTheme === "light" || resolvedTheme === "theme-erasmus-light";
      setTheme(isLight ? "dark" : "light");
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [resolvedTheme, setTheme]);

  return null;
}

export { ThemeProvider };
