"use client";

import { KeyboardIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const mounted = React.useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const { resolvedTheme, setTheme, theme } = useTheme();
  const selectedTheme = mounted && resolvedTheme === "dark" ? "dark" : "light";

  function changeTheme(values: string[]) {
    const nextTheme = values.at(-1);

    if (nextTheme === "light" || nextTheme === "dark") {
      setTheme(nextTheme);
    }
  }

  function changeFullTheme(value: string | null) {
    if (value && isThemeValue(value)) {
      setTheme(value);
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

      <FieldSet>
        <FieldLegend variant="label">Design theme</FieldLegend>
        <FieldDescription>
          All seven themes side by side — EU Erasmus light, five Ember vibes, and
          legacy dark.
        </FieldDescription>
        <Select
          disabled={!mounted}
          onValueChange={changeFullTheme}
          value={mounted && theme ? theme : undefined}
        >
          <SelectTrigger aria-label="Design theme">
            <SelectValue placeholder="Select a theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {THEMES.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {themeIcon(entry.value)}
                  {entry.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </FieldSet>

      <Alert variant="accent">
        <KeyboardIcon aria-hidden="true" className="text-primary" />
        <AlertTitle>Switch from anywhere</AlertTitle>
        <AlertDescription>
          Press <Kbd>d</Kbd> anywhere in Cost Tracker to switch between light and
          dark. The shortcut stays inactive while you are typing.
        </AlertDescription>
      </Alert>
    </div>
  );
}
