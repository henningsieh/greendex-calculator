import { cn } from "cn";

import { THEMES } from "@/lib/themes";

/* Central theme preview dot. Single source of truth for how a theme looks
   in every picker (header switcher, user-settings Appearance): amplified
   stage-hue swatch from the theme registry, ring-delineated so dark dots
   read on dark menus and light dots on light menus. */
export function ThemeSwatch({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const swatch = THEMES.find((entry) => entry.value === value)?.swatch;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-3 shrink-0 rounded-full ring-1 ring-foreground/25 ring-inset",
        className,
      )}
      style={swatch ? { backgroundColor: swatch } : undefined}
    />
  );
}
