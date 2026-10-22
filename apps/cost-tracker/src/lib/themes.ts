/* Theme registry — 7-theme scope (LOCKED 2026-10-11).
   `light` = EU-Erasmus light (:root, untouched).
   `dark` = legacy zinc dark (.dark, untouched).
   `theme-ember-*` = the five Ember vibes (DESIGN.md frontmatter).
   Values are next-themes class names; each maps 1:1 to a globals.css block. */

export const THEMES = [
  {
    value: "light",
    label: "EU Erasmus Light",
    description: "Calm EU Erasmus identity — blue base, yellow accents.",
  },
  {
    value: "theme-ember-plum",
    label: "Ember Plum",
    description: "Plum-black stage, single fire accent. Default Ember vibe.",
  },
  {
    value: "theme-ember-midnight",
    label: "Ember Midnight",
    description: "Deep blue-black vibe. Fire stays #FFB800.",
  },
  {
    value: "theme-ember-violet",
    label: "Ember Violet",
    description: "Violet-black vibe. Fire stays #FFB800.",
  },
  {
    value: "theme-ember-abyss",
    label: "Ember Abyss",
    description: "Near-black blue-grey vibe. Fire stays #FFB800.",
  },
  {
    value: "theme-ember-royal",
    label: "Ember Royal",
    description: "Royal blue vibe. Fire stays #FFB800.",
  },
  {
    value: "dark",
    label: "Legacy Dark",
    description: "Previous zinc dark. Kept as the 7th option.",
  },
] as const;

export type ThemeValue = (typeof THEMES)[number]["value"];

export const THEME_VALUES: readonly string[] = THEMES.map((t) => t.value);

export function isThemeValue(value: string | undefined): value is ThemeValue {
  return THEME_VALUES.includes(value ?? "");
}
