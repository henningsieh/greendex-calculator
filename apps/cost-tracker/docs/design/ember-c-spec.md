# EMBER C — Component Spec (Cost Tracker dark)

Quelle: `docs/design/prototype/ember-c.html` (freigegeben 2026-10-11).
Verbindlich für alle künftigen Ember-Komponenten. Politur (Motion/Animation)
durch Design-Skills läuft später über den Mini-Site-Schritt — die Spec hier
ist das Fundament, kein Ersatz dafür.

## Palette (1 Akzent, keine Ausnahmen)

- `--bg: #0E0A14` Pflaumen-Schwarz, Page-Basis
- `--ink: #F7F2E9` warmes Weiß, Text
- `--muted: #B3A8C4` Lavendel-Grau, Sekundärtext
- `--faint: #7C7192` Meta/Details
- `--fire: #FFB800` DER Akzent (Interaktion, Highlights, Fokus)
- `--fire-hot: #FFCC33` nur Hover
- `--line: rgba(255,255,255,.10)` einzige Linienfarbe
- Verboten im Dark: EU-Blau, zweites Orange, Verläufe als Deko, Lichtstreifen.

## Typo (2 Fonts, sonst nichts)

- Sans: Inter — Headlines 900, Tracking −.03em, Desktop-Clamp bis ~124px
- Mono: JetBrains Mono — Eyebrows (11–12px, Tracking .2–.26em, uppercase),
  Zahlen-Details, Terminal, Meta-Zeile
- Regel: Riesen-Headline + winziges Mono-Label = der Kontrast, der trägt.

## Stat-Raster (die 6er-Karte aus dem Mockup)

- Desktop 3-spaltig, Mobile 2-spaltig; ein Container, `overflow:hidden`,
  Radius 22px, Hintergrund `rgba(255,255,255,.02)`
- Trennung nur durch 1px `--line` (unten + rechts), keine Cards mit Gap
- Stat-Padding ~38px, Zahl 56px/800 tabular-nums, Einheit in `--fire`
- Label: Mono 11px, Tracking .2em, `--muted`; Detailzeile Mono, `--faint`
- Genau EINE Hero-Stat: `linear-gradient(180deg, rgba(255,184,0,.13), transparent 75%)`
- Glas-Kante: `inset 0 1px 0 rgba(255,255,255,.07)` auf dem Container

## Brand-Zeichen (LOCKED 2026-10-11)

- Sternenkranz aus 12 Feuer-Punkten (`#FFB800`), EU-Symbolik, wird nicht mehr verändert
- Header-Lockup: Kranz (34px) + `GreenEx` (Sans 800, 19px) + `Cost Tracker` (Mono, 12px, Tracking .18em)
- Hero-Pille über der Headline: `GREENEX COST TRACKER · ERASMUS EDITION`, Glas-Badge mit Feuer-Punkt, Abstand zum Content eng (54px Desktop / 34px Mobile)

## Eyebrow-Muster

- Mono 12px, Tracking .26em, `--fire`, kein Punkt davor nötig
- Beispiele: `COST TRACKER · EMBER C`, `DER ABLAUF`

## CTA

- Primär: `--fire`-Fläche, dunkler Text `#1C1200`, Pill, Glow
  `0 0 32px rgba(255,184,0,.4)` + `inset 0 1px 0 rgba(255,255,255,.5)`
- Ghost: transparent, 1px `--line`, kein Glow
- Fokus-Ring: 3px `--fire`, Offset 4px (aus Light-System übernommen)

## Terminal-/Checklist-Karte

- Basis `#080510`, 1px `--line`, Radius 16px, Mono 13px, Zeilenhöhe ~2.1
- Fenster-Punkte oben (erster Punkt `--fire`), Statuszeile unten in `--fire`
- Symbole: `✓` erledigt, `◌` offen — Text bleibt `--muted`, Werte `--ink`

## Motion-Entscheide (LOCKED 2026-10-11)

- **Pulse** (`glowPulse`, Glow-Atem 2.4s) ist reserviert für den Main-CTA der
  zukünftigen Landingpage — nirgendwo sonst verwenden, auch nicht im
  Motion-Lab als Dauerzustand (dort nur Vergleichszweck)
- Die Landingpage ist der erste echte Bauabschnitt, sobald das Design steht
- **Pending** (LOCKED 2026-10-11) ist die Variante für React-Query-`isPending`:
  reduzierte Farbe wie `:disabled` (55%, Glow bleibt, `cursor:wait`), dazu
  Sweep-Band (1.4s-Loop, transform-only) plus Tipp-Punkte statt Pulsieren.
  Im Mock per CSS-Loop, in React pro Pending-State triggern.
  Kein Pulsieren auf Pending-Buttons — das gehört allein dem Landingpage-CTA

## Hochglanz (Aura, dosiert)

- Ein einziges radiales Aura-Element über der Hero:
  `radial-gradient(ellipse, rgba(255,184,0,.16), transparent 70%)`
- Headline-Akzent mit `text-shadow: 0 0 60px rgba(255,184,0,.45)`
- Mehr Glanz nur nach Freigabe — nie flächendeckend, nie Streifen.

## Anwendung auf echte App-Komponenten

- Claim-Workspace-Karten, Kostenposten-Listen, Beleg-Status: Raster + Eyebrow
  - Mono-Details aus dieser Spec übernehmen, nicht neu erfinden
- LB-Token (`globals.css` `:root`/`.dark`) folgen erst nach Mini-Site-Feinschliff.
