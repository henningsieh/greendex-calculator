/* Theme registry — 4-theme scope.
   `light` = EU-Erasmus light (:root, untouched).
   `theme-erasmus-*` = the three Erasmus dark vibes (DESIGN.md frontmatter).
   Values are next-themes class names; each maps 1:1 to a globals.css block.
   Array order is the display order in every picker (header switcher,
   user-settings Appearance, design-system page). */

export const THEMES = [
  {
    value: "theme-erasmus-light",
    label: "Erasmus Light",
    description: "Calm EU Erasmus identity — blue base, yellow accents.",
    // Preview dot: amplified stage hue so options stay distinguishable at
    // 12px. Literal --backgrounds are all near-black and unreadable as dots.
    swatch: "#edf2f8",
  },
  {
    value: "theme-erasmus-dark",
    label: "Erasmus Dark",
    description: "Near-black blue-grey vibe. Fire stays #FFB800.",
    swatch: "#3f4a63",
  },
  {
    value: "theme-erasmus-midnight",
    label: "Erasmus Midnight",
    description: "Deep blue-black vibe. Fire stays #FFB800.",
    swatch: "#33428a",
  },
  {
    value: "theme-erasmus-violet",
    label: "Erasmus Violet",
    description: "Violet-black vibe. Fire stays #FFB800.",
    swatch: "#7a4fb5",
  },
] as const;

export type ThemeValue = (typeof THEMES)[number]["value"];

export const THEME_VALUES: readonly string[] = THEMES.map((t) => t.value);

export function isThemeValue(value: string | undefined): value is ThemeValue {
  return THEME_VALUES.includes(value ?? "");
}
