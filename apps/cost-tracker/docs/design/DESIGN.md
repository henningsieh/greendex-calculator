---
colors:
  bg: "#0E0A14"
  ink: "#F7F2E9"
  muted: "#B3A8C4"
  faint: "#7C7192"
  fire: "#FFB800"
  fire-hot: "#FFCC33"
  line: "rgba(255,255,255,.10)"
  on-fire: "#1C1200"
  term-bg: "#080510"
  vibes:
    plum:
      {
        bg: "#0E0A14",
        muted: "#B3A8C4",
        faint: "#7C7192",
        line: "rgba(255,255,255,.10)",
      }
    midnight:
      {
        bg: "#0A1230",
        muted: "#9DACc9",
        faint: "#6B7A99",
        line: "rgba(147,180,255,.13)",
      }
    violet:
      {
        bg: "#130B26",
        muted: "#B8A9D4",
        faint: "#7E6F9C",
        line: "rgba(200,170,255,.12)",
      }
    abyss:
      {
        bg: "#070A16",
        muted: "#98A0B8",
        faint: "#5D6478",
        line: "rgba(255,255,255,.09)",
      }
    royal:
      {
        bg: "#0B1642",
        muted: "#A3B2D8",
        faint: "#6F7EA8",
        line: "rgba(147,180,255,.15)",
      }
typography:
  sans: "Inter, system-ui, sans-serif"
  mono: "JetBrains Mono, ui-monospace, monospace"
  display:
    {
      weight: 900,
      tracking: "-.03em",
      size: "clamp(56px, 8.5vw, 124px)",
      line-height: 1.0,
    }
  eyebrow:
    {
      family: mono,
      size: "11-12px",
      tracking: ".2-.26em",
      transform: uppercase,
      color: "{colors.fire}",
    }
  stat-number:
    { size: "56px", weight: 800, tracking: "-.03em", numeric: tabular-nums }
rounded:
  pill: 999px
  card: 22px
  cell: 18px
  term: 16px
spacing:
  page-max: 1180px
  page-pad: 48px
  stat-pad: 38px 36px
  hero-pill-gap: 54px
components:
  - button-primary
  - button-ghost
  - button-pending
  - button-cta
  - stat-grid
  - terminal-card
  - hero-pill
  - brand-mark
---

# EMBER C — DESIGN.md (destilliert aus Spec + Mini-Site)

## Overview

Ember C ist das gelockte Dark-Theme des GreenEx Cost Tracker (Erasmus Edition).
Pflaumen-Schwarz als Bühne, ein einziger Feuer-Akzent, Riesen-Headlines in Inter
Black gegen winzige Mono-Labels in JetBrains Mono. Das System kennt genau vier
Button-Rezepte, ein fugenloses Stat-Raster, eine Terminal-Karte und einen
stillstehenden Aura-Schein. Alles andere ist verboten.

## Colors

- Page floor `{colors.bg}` (`#0E0A14`), Text `{colors.ink}` (`#F7F2E9`).
- Sekundärtext `{colors.muted}`, Meta `{colors.faint}`.
- Akzent `{colors.fire}` für Interaktion, Highlights, Fokus; `{colors.fire-hot}`
  nur als Hover-Feuer auf enabled Buttons.
- Einzige Linienfarbe `{colors.line}` (1px, 10% Weiß).
- Text auf Feuer: `{colors.on-fire}` (`#1C1200`).
- Terminal-Basis `{colors.term-bg}` (`#080510`).
- Fünf Vibes wechseln nur `bg/muted/faint/line`; Feuer bleibt immer `#FFB800`.

## Typography

- Sans: Inter. Headlines 900, Tracking −.03em, Desktop-Clamp bis ~124px.
- Mono: JetBrains Mono. Eyebrows 11–12px, Tracking .2–.26em, uppercase;
  Zahlen-Details, Terminal, Meta-Zeile.
- Leitregel: Riesen-Headline + winziges Mono-Label — dieser Kontrast trägt.
- Stat-Zahlen: 56px/800, `tabular-nums`, Einheit in Feuer (32px).

## Layout

- Page-Max 1180px, Seiten-Padding 48px (Mobile 18px).
- Hero-Pille über der Headline, Abstand zum Content eng (54px Desktop / 34px Mobile).
- Stat-Raster: ein Container (`overflow:hidden`, Radius 22px,
  `rgba(255,255,255,.02)`), Desktop 3-spaltig, Mobile 2-spaltig.
  Trennung nur durch 1px-Linien (unten + rechts), keine Cards mit Gap.
- Zweispalter Agent-Sektion (Text + Terminal), einspaltig auf Mobile.

## Elevation

- Kein Tailwind-Schatten-System. Tiefe kommt aus: Glas-Kante
  (`inset 0 1px 0 rgba(255,255,255,.07)`), Primary-Glow
  (`0 0 32px rgba(255,184,0,.4)` + `inset 0 1px 0 rgba(255,255,255,.5)`),
  CTA-Glow im Ruhezustand 32px / 18px straff beim Primary-Lock.
- Aura: ein radiales Element über der Hero
  (`radial-gradient(ellipse, rgba(255,184,0,.16), transparent 70%)`), statisch
  (`animation:none`). Headline-Akzent via `text-shadow: 0 0 60px rgba(255,184,0,.45)`.

## Components

- `button-primary`: Feuer-Fläche, Pille, Lift (−2px, Schatten wächst) + Shine-Sweep
  - Press-Scale (.97, 160ms). Hover-Feuer nur enabled; Shine ruht unsichtbar.
- `button-ghost`: transparent, 1px Linie, kein Glow. Hover nur Hauch-Weiß (6%)
  - Feuer-Rahmen, nie Vollfläche.
- `button-pending`: Color-Mix 45% Feuer auf Pflaume, Text gedimmt, Glow weicher,
  `cursor:not-allowed`, kein `opacity`. Sweep-Band (1.4s-Loop, transform-only)
  - Tipp-Punkte statt Pulsieren. Zelle ist `calm`.
- `button-cta`: Glow-Atem (`glowPulse` 2.4s), nur Landingpage-Main-CTA.
- `stat-grid`: Hero-Stat mit `linear-gradient(180deg, rgba(255,184,0,.13), transparent 75%)`.
- `card-hover`: jede Karte hebt −2px + Feuer-Rahmen (`.45`), 220ms Custom-Curve,
  nur hinter Hover-Gate. `card-active`: Dauerzustand Feuer-Rahmen + Amber-Washgang
  (Verlauf von oben). Zellen mit disabled Buttons (`:has(button:disabled)`) und
  `calm`-Zonen sind vom Hover ausgenommen.
- `hero-pill`: Glas-Badge (Pille, Feuer-Punkt, `inset 0 1px 0 rgba(255,255,255,.08)`).
- `terminal-card`: `#080510`, Radius 16px, Mono 13px, Zeilenhöhe ~2.1,
  Fenster-Punkte (erster Feuer), Statuszeile in Feuer, `✓`/`◌`-Symbole.
- `brand-mark`: Sternenkranz aus 12 Feuer-Punkten (SVG, 34px Header / 120px Brand).
- Fokus: 3px Feuer, Offset 4px. Motion-Curves: `--ease-out: cubic-bezier(0.23,1,0.32,1)`,
  `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`. Reduced-Motion macht alles statisch.

## Do's and Don'ts

- Do: genau ein Feuer-Akzent überall (Interaktion, Highlights, Fokus).
- Do: Hover- und Press-Feedback nur auf enabled Buttons.
- Do: Pending-Sprache (Sweep + Punkte, `calm`) für alle Warte-Zustände.
- Do: CTA-Atem nur für den Landingpage-Main-CTA.
- Don't: kein EU-Blau, kein zweites Orange, keine Deko-Verläufe, keine Lichtstreifen im Dark.
- Don't: kein `opacity`-Dimmen auf Pending (würde Glow mitdimmen).
- Don't: kein Pulsieren auf Pending — gehört allein dem CTA.
- Don't: keine langsamen Groß-Animationen, die Layout verschieben.
- Don't: keine Radius- oder Font-Ausnahmen (Pille / 22 / 18 / 16; Inter + JetBrains Mono nur).
- Don't: kein Vollflächen-Hover auf Ghost.

## Known Gaps

- Aktueller `globals.css`-Token-Stand ist noch das EU-Light-System
  (`--primary: #003399`, `--background: #EDF2F8`), nicht Ember C — Mapping steht aus.
- `.dark`-Block ist generisches Zinc/Blue, keine Ember-Werte.
- Vibes (midnight/violet/abyss/royal) existieren nur als Mini-Site-`data-vibe`-Override,
  kein App-Theme-Slot.
- Sternenkranz nur als Inline-SVG in der Mini-Site, keine Komponente.
- Sweep-Loop, Glow-Atem, Shine-Pseudo-Element haben keinen shadcn-Slot (siehe REPORT).
