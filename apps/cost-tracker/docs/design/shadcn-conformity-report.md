# shadcn-Konformitäts-Report — Ember C

Quelle: `ember-c-spec.md` (LOCKED 2026-10-11) + `mini-site/index.html` + `globals.css` (`design/eu-erasmus-theme`).
Skill-Maßstab: shadcn `design-system.md` Steps 3–5 (Extraktion → Token-Mapping → CVA-Recipes).

## a) Locked-Entscheide → shadcn-Slot (Step-4-Mapping)

| #   | Locked-Entscheid                                                              | shadcn-Variable / Rezept                                                                                                   | Maschinell abbildbar?                                                     |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Sternenkranz (12 Feuer-Punkte, SVG)                                           | kein Slot (`--brand` wäre nur Farbe)                                                                                       | NEIN — Custom-SVG-Komponente nötig                                        |
| 2   | Primary Lift + Shine + Press-Scale                                            | `Button default` (`--primary`/`--primary-foreground` + neuer `--primary-active: #FFCC33`); Lift/Scale per CVA, Shine NICHT | TEILWEISE — Farbe+Höhen ja, Shine-`::after`-Sweep nein                    |
| 3   | Ghost-Hauch (6% Weiß + Feuer-Rahmen, nie Vollfläche)                          | `Button ghost` → `--accent: rgba(255,255,255,.06)`-Wash + Border `--border` → Feuer-Rahmen                                 | JA — reines CVA-Rezept                                                    |
| 4   | Pending Sweep + Punkte (Color-Mix 45%, kein opacity)                          | kein Slot; Farbe als `--pending-*` Custom-Token, Sweep-`.sweep`-Span + `sweepLoop`-Keyframes + Dots-Keyframes              | NEIN — Loop + Dots haben keinen Slot, nur Custom-CSS                      |
| 5   | CTA Glow-Atem (`glowPulse` 2.4s)                                              | kein Slot; `box-shadow`-Keyframes-Loop                                                                                     | NEIN — unendlicher Shadow-Loop ist kein Theme-Token                       |
| 6   | Card-Hover (−2px + Feuer-Rahmen, 220ms, Hover-Gate)                           | `Card` (Fill `--card`, Ring `--border`); Hover-Translate per CVA/Utility                                                   | TEILWEISE — Tokens ja, `:has(button:disabled)`-Exempt + `calm`-Zonen nein |
| 7   | Card-Active (Feuer-Rahmen + Amber-Washgang von oben)                          | kein Slot (Gradient `rgba(255,184,0,.08→.02)`)                                                                             | NEIN — Custom-Klasse nötig                                                |
| 8   | 5 Vibes (nur bg/muted/faint/line wechseln)                                    | `.dark`-Mechanik könnte Vibes tragen (`class="dark"` pro Sektion möglich), aber 4 Custom-Varianten                         | TEILWEISE — Mechanik ja, 4 zusätzliche Theme-Blöcke Handarbeit            |
| 9   | 1-Akzent-Regel (nur Feuer, Verbote: EU-Blau, 2. Orange, Deko-Gradienten)      | `--primary/--ring/--chart-*` disziplinierbar                                                                               | JA — Policy, keine Technik                                                |
| 10  | Motion-Regeln (Custom-Curves, 220/160ms, Reduced-Motion statisch, Hover-Gate) | `--ease-*` als Custom-Tokens; Dauern in CVA; Reduced-Motion-Block manuell                                                  | TEILWEISE — Werte ja, Loops/Gates Handarbeit                              |
| 11  | Stat-Raster (1 Container, fugenlos, 1px-Trenner, Hero-Gradient)               | kein shadcn-Pattern (Card-System will Gap-Cards)                                                                           | NEIN — Custom-Grid-Komponente                                             |
| 12  | Terminal-Karte (`#080510`, Fenster-Punkte, `✓`/`◌`, Caret)                    | `Card` + Mono-Type-Utility annäherbar                                                                                      | TEILWEISE — Optik ja, Caret-Blink + Stagger nein                          |
| 13  | Hero-Pille (Glas-Badge, Pille, Feuer-Punkt)                                   | `Badge` Pill-Variante                                                                                                      | JA — CVA-Rezept                                                           |
| 14  | Aura (radial, statisch, `animation:none`) + Headline-`text-shadow`            | kein Slot                                                                                                                  | NEIN — Custom-Layer                                                       |

Token-Kern (direkt mappbar): `--background: #0E0A14`, `--foreground: #F7F2E9`,
`--muted`/`--muted-foreground: #B3A8C4`, `--primary: #FFB800`,
`--primary-foreground: #1C1200`, `--primary-active: #FFCC33`,
`--card: rgba(255,255,255,.02)`, `--border/--input: rgba(255,255,255,.10)`,
`--ring: #FFB800`, Radius `pill/22/18/16` via `--radius-*`-Pins,
Fonts Inter + JetBrains Mono via Fontsource, Focus `3px + 4px Offset`.
Aktuell steht in `globals.css` noch das EU-Light-System (`#003399`/`#EDF2F8`) —
das Mapping ist unangewendet.

## b) Verdikt: Kann die Skill-Pipeline originalgetreu bauen?

**Verdikt: Nein — ca. 60–70% (Tokens + Primitives) ja, das Ember-Gesicht nein.**
`init` + `add --all` + Token-Mapping + CVA-Rezepte liefern: Feuer-Primary,
Ghost-Hauch, Pillen/Badges, Radius-, Font- und Fokus-System, Hover-Grundlagen.
Nicht lieferbar per Pipeline: Sweep-Loop, Glow-Atem-Loop, Shine-`::after`,
Sternenkranz-SVG, fugenloses Stat-Raster, Amber-Wash-Active, Aura-Layer,
`calm`-/`​:has()`-Logik, Vibe-Varianten, Caret/Dots/Stagger-Keyframes.
Dafür braucht es Handarbeit: Custom-Keyframes + Utilities
(`sweepLoop`, `glowPulse`, `dotBlink`, `firePulse`, `fadeUp`, `caretBlink`),
eine `PendingButton`- und `StatGrid`-Komponente, eine `StarWreath`-Komponente,
einen Aura-Layer, vier Vibe-Theme-Blöcke und einen Reduced-Motion-Block.
Empfohlener shadcn-Base-Stil: `luma` (Pill-Buttons, weiche Elevation, atmende Layouts)
oder `maia` (40px+ Controls, 12px+ Karten-Radius) — Geometrie passt zu Pille/22px.

## c) Motion im index.html vs. Emil-Checklist (5 Findings)

| Before                                                                                | After                                                                                                                                       | Why                                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `animation: glowPulse 2.4s` auf `.m-pulse` animiert `box-shadow`                      | Loop behalten (CTA = selten, Marketing ok), aber auf `opacity`/`transform` eines Glow-Layers umbauen                                        | Nur transform+opacity laufen auf der GPU; Shadow-Loops janken unter Last                                                     |
| `@keyframes sweepLoop` mit `var(--ease-in-out)` für konstante Bewegung                | `animation: sweepLoop 1.4s linear infinite`                                                                                                 | Konstante Motion (Sweep, Progress) gehört linear; ease-in-out stottert am Loop-Punkt                                         |
| `h1 .fire { animation: firePulse 4s infinite }` auf der Hero-Headline                 | Statischer `text-shadow: 0 0 60px …` (Spec-Hochglanz ist gelockt still)                                                                     | Seltene Hero-Animation wäre ok, aber Spec sagt Aura/Glanz steht still — Kohärenz schlägt Deko                                |
| `.cta { transition: transform 160ms, box-shadow 200ms }`                              | `transition: transform 160ms ease-out, background-color 200ms ease`                                                                         | Box-Shadow-Transitions sind nicht interruptibel-günstig; Farbe+Lift reichen als Feedback                                     |
| `.dots i { animation: dotBlink 1.2s ease-in-out infinite }` ohne Reduced-Motion-Lücke | bereits vorhanden: `@media (prefers-reduced-motion: reduce) { … animation: none }` — behalten + Stagger-Delays (.2s/.4s) auf 30–80ms prüfen | Dots sind ok (Opacity, seltene Pending-Zone); der Reduced-Motion-Block ist vorbildlich und muss in die App übernommen werden |

Positiv nach Emil: Press-Scale `.97`/160ms, Hover hinter `@media (hover:hover) and (pointer:fine)`,
`scale(0)` nirgends, Stagger-`fadeUp` mit 60ms-Schritten, `caretBlink` mit `steps(1)`,
keine Animation auf Keyboard-Actions.
