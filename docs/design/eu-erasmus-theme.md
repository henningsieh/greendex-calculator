# EU Erasmus Theme — Design Brief

New adapted design system for Calculator and Cost Tracker, starting from `main`.

## Themes

- **eu-erasmus (light):** technically stays `light` under the hood; only the
  name and the visual language change. Calm EU Erasmus identity: blue as the
  quiet base color, yellow reserved for energy accents.
- **ember (dark, working title):** technically stays `dark` under the hood,
  but goes fully custom. Reference: near-black plum base, exactly one warm
  accent (Erasmus yellow as fire), oversized type, generous whitespace,
  disciplined spacing. Crazy needs rules, otherwise it becomes carnival.

## Non-goals for this branch

- No behavior changes, no API changes, no migration changes.
- Theme switching mechanics stay untouched; only tokens, palettes, and
  type scale move.

## Next steps

1. Token inventory of the current light/dark setup.
2. eu-erasmus light palette + type proposal.
3. ember dark proposal with the single-accent rule.
4. Preview deployment per app for visual review.
