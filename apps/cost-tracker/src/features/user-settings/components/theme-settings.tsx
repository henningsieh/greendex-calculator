"use client";

import { KeyboardIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const subscribeToHydration = () => () => undefined;

export function ThemeSettings() {
  const mounted = React.useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const { resolvedTheme, setTheme } = useTheme();
  const selectedTheme = mounted && resolvedTheme === "dark" ? "dark" : "light";

  function changeTheme(values: string[]) {
    const nextTheme = values.at(-1);

    if (nextTheme === "light" || nextTheme === "dark") {
      setTheme(nextTheme);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <FieldSet>
        <FieldLegend variant="label">Color theme</FieldLegend>
        <FieldDescription>
          Choose the appearance used throughout Cost Tracker.
        </FieldDescription>
        <ToggleGroup
          aria-label="Color theme"
          disabled={!mounted}
          onValueChange={changeTheme}
          value={[selectedTheme]}
          variant="outline"
        >
          <ToggleGroupItem aria-label="Use light theme" value="light">
            <SunIcon data-icon="inline-start" />
            Light
          </ToggleGroupItem>
          <ToggleGroupItem aria-label="Use dark theme" value="dark">
            <MoonIcon data-icon="inline-start" />
            Dark
          </ToggleGroupItem>
        </ToggleGroup>
      </FieldSet>

      <Alert className="border-primary/25 bg-primary/10 text-foreground after:bg-primary">
        <KeyboardIcon aria-hidden="true" className="text-primary" />
        <AlertTitle>Switch from anywhere</AlertTitle>
        <AlertDescription className="text-foreground/80">
          Press <Kbd className="bg-primary/15 text-foreground">d</Kbd> anywhere in
          Cost Tracker to switch between light and dark. The shortcut stays
          inactive while you are typing.
        </AlertDescription>
      </Alert>
    </div>
  );
}
