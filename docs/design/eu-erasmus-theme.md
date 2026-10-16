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

## Theme scope (LOCKED 2026-10-11)

7 themes, selectable side by side via next-themes:

- `light` = EU-Erasmus Light (bestehend, unangetastet)
- 5 Ember vibes = plum, midnight, violet, abyss, royal (neu)
- Altes Zinc-Dark bleibt als 7. Option erhalten

## shadcn direction (LOCKED 2026-10-11)

Maximale shadcn-Nähe: gelockte Looks bleiben, Implementierung wird
shadcn-idiomatisch. Hebel aus dem Conformity-Report:

- Vollständiges Token-Mapping aller 7 Themes auf shadcn-Variablen
  (`--primary`, `--accent`, `--muted`, `--card`, `--border`, `--ring`,
  Radius-Scale, Fonts) — keine Rohwerte in Components
- Customs als shadcn-Komponenten: `StarWreath` als Icon-Komponente,
  `StatGrid`/`PendingButton`/`Aura` als Blöcke mit `cva`-Varianten
- `data-*`-Attribute statt `:has()` (shadcn-Idiom: `data-disabled`),
  `Spinner`-Muster prüfen wo sinnvoll, `Card`-Komposition wo möglich
- Rest (~15%: Loops, SVG-Marke, fugenloses Raster, Aura) bleibt naturgemäß
  Custom-CSS — shadcn sieht Brand-Motion dort auch vor

## Night mandate 2026-10-12 (answers: b + c + a, Modellwunsch: GPT Sol 6.1 / Codex Subscription)

- Richtung: teilweise ersetzen (b) — Standard-Ersatz wo echt (Spinner-
  Prüfung für Sweep), Markenzeichen bleiben (Sternenkranz, Raster, Aura)
- Umfang: groß (c) — 7-Theme-Tokens + Komponenten-Umbau + Showcase-Page
- Rechte: voll (a) — pushen + Preview-Builds triggern erlaubt
- Priorität: shadcn-Standard > Emil > gelockter Look (außer Markenzeichen)
- Ziel ~90% shadcn-Konformität. Review-Skills laufen zum Schluss.
- Schluss-Review läuft als eigener Subagent auf openai/gpt-6.1-sol
  (Owner-Vorgabe 2026-10-12).
- Verbote: main, Spike-Branch, Env-Backups, Calculator-App, Production
- EXTENSION 2026-10-12 00:09 (Owner): nach Design + Review NICHT aufhören —
  weiter in die echte Implementierung: Design in die reale Cost-Tracker-
  Architektur transformieren (Claim-Workspace, Kostenposten, Beleg-Status
  etc. übernehmen Ember-Tokens/-Komponenten), so weit kommen wie möglich.
  Keine Verhaltens-/API-/Migrations-Änderungen (Brief-Non-Goals bleiben).

## Non-goals for this branch

- No behavior changes, no API changes, no migration changes.
- Theme switching mechanics stay untouched; only tokens, palettes, and
  type scale move.

## Preview

- PR preview (Cost-Tracker): `261.cost-tracker.apps.sieh.org`, rebuilt on every branch commit.
- Dedicated preview database: `cost_tracker_pr261` on greendex-preview-postgres (migrated + seeded).

## Next steps

1. Token inventory of the current light/dark setup.
2. eu-erasmus light palette + type proposal.
3. ember dark proposal with the single-accent rule.
4. Preview deployment per app for visual review.

## Auto-deploy check

- 2026-10-11: `is_auto_deploy_enabled=true` on the Cost-Tracker app so every
  branch commit retriggers the PR preview (`261.cost-tracker.apps.sieh.org`).
