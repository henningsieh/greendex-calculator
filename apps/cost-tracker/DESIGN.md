---
name: Cost Tracker
description: Quiet, audit-grade administration of Erasmus travel-cost reimbursement.
colors:
  erasmus-blue: "#003399"
  erasmus-blue-hover: "#002b85"
  seal-gold: "#ffcc00"
  ember-amber: "#ffb800"
  ledger-ink: "#102b50"
  counter-paper: "#edf2f8"
  parchment: "#f7f2e9"
  card-white: "#ffffff"
  muted-slate: "#52647a"
  hairline: "#cdd5e0"
  signal-green: "#15803d"
  signal-red: "oklch(0.577 0.245 27.325)"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(56px, 8.5vw, 124px)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.1em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.26em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  card: "32px desktop / 16px mobile"
  shell-x: "20px mobile / 34px tablet / 40px desktop"
components:
  button-primary:
    backgroundColor: "{colors.erasmus-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "0 24px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.erasmus-blue-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ledger-ink}"
    rounded: "{rounded.xl}"
    height: "40px"
  card:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.2xl}"
    padding: "32px desktop / 16px mobile"
  input:
    backgroundColor: "color-mix(in srgb, #b2cdff 30%, transparent)"
    rounded: "{rounded.xl}"
    height: "40px"
    padding: "0 12px"
---

# Design System: Cost Tracker

## Overview

**Creative North Star: "The Quiet Ledger"**

Cost Tracker looks like the desk it replaces: a calm, well-lit counter where every figure is traceable and every decision is signed. Daylight Erasmus blues carry the working day; ember amber appears only where action lives — a hover, a focus ring, a single call to action. Nothing glows for decoration. The interface speaks softly and guides firmly: fixed, predictable controls, sentence-case data, tabular numerals, and generous focus states that make keyboard work first-class.

Brand theatre (display type, aura washes, the breathing CTA) belongs to marketing surfaces, never to staff workflows. Inside the app, restraint is the personality: tonal layering instead of shadows, hairline rings instead of borders that shout, one primary action per view.

**Key Characteristics:**

- Daylight administration, ember accents only as state or signal.
- Predictable controls: fixed copy, generous focus, no payload inside labels.
- Tonal depth: flat surfaces, hairline rings, glow reserved for brand moments.
- Bilingual by construction: seven locales, wrapping-safe, tabular numerals.

## Colors

Daylight blues do the work; ember amber seals the action. The default light theme carries the day shift, three self-sufficient Ember dark vibes cover the night.

### Primary

- **Erasmus Blue** (#003399): the working primary in light — buttons, links, rings, active states. Hover deepens to #002B85. Where and why: every affirmative control; its rarity in dark themes is intentional.
- **Ember Amber** (#FFB800): the primary in all three dark vibes, on deep brown-black text (#1C1200). Where and why: the same affirmative controls after dark, plus eyebrows and seals in light.

### Secondary

- **Seal Gold** (#FFCC00): the brand mark in light — link underlines, feedback borders, ember washes. In dark vibes the same role is played by Ember Amber.

### Tertiary

- **Signal Green** (#15803d in light, #4ADE80 in dark): settled, paid, valid. Used sparingly, always with text, never color alone.
- **Signal Red** (oklch(0.577 0.245 27.325) in light, warmer oklch(0.5942 0.2394 22.22) in dark): destructive actions and invalid states, always paired with labels.

### Neutral

- **Ledger Ink** (#102B50): text, icons, and structure in light.
- **Counter Paper** (#EDF2F8): the light page ground.
- **Card White** (#FFFFFF): light surfaces — cards, popovers, dialogs.
- **Parchment** (#F7F2E9): text in all dark vibes.
- **Muted Slate** (#52647A in light; theme-tinted in darks): secondary text, always meeting contrast on its ground.
- **Hairline** (#CDD5E0 in light; tinted translucent borders in darks): the quietest visible divider.

### Dark vibes

Three self-sufficient themes, no cross-theme inheritance: **Midnight** (ground #0A1230, muted #9DACC9, border rgba(147,180,255,.13)), **Violet** (ground #130B26, muted #B8A9D4, border rgba(200,170,255,.12)), **Dark** (ground #070A16, muted #98A0B8, border rgba(255,255,255,.09)). All share Ember Amber primary, Parchment ink, 5%-white cards, and the same glow vocabulary. System theme is the default; the hotkey `d` flips light and dark from anywhere.

### Named Rules

**The Sacred Glow Rule.** Glow and shadow appear only as state — hover lift, focus, the breathing CTA. A surface that glows at rest is a bug.
**The One Voice Rule.** Ember Amber is used sparingly in light (eyebrows, seals, washes); its rarity is the point. If everything is amber, nothing is.

## Typography

**Display Font:** Inter Black (with system sans fallback)
**Body Font:** Inter (with system sans fallback)
**Label/Mono Font:** JetBrains Mono (with ui-monospace fallback)

**Character:** Inter does the talking everywhere; weight and tracking do the ranking, never a second sans. JetBrains Mono is the official voice — eyebrows, statistics, terminal evidence.

### Hierarchy

- **Display** (900, clamp(56px, 8.5vw, 124px), line-height 1, tracking −0.03em): marketing headlines and hero numbers only. Never inside staff workflows.
- **Eyebrow** (mono, 500, 12px, tracking 0.26em, uppercase, primary color): section seals above display type and brand moments.
- **Stat Number** (800, 56px, tracking −0.03em, tabular numerals): hero metrics on brand surfaces.
- **Body** (400–500, 0.875rem in UI, 1rem in documents and dialogs): everything staff reads. Data cells stay sentence case; tabular numerals for every figure.
- **Label** (600, 0.75rem, tracking 0.1em): micro-labels on true buttons (uppercase, incumbent) and form labels. New and revised controls speak in sentence case per the chosen guiding voice; existing uppercase button labels migrate opportunistically.

### Named Rules

**The Guiding Voice Rule.** Controls guide in plain sentence case; ember encourages, it never shouts. Display type stays out of workflows.
**The Figures Line Up Rule.** Numerals in data are always tabular (`tabular-nums`); a column of amounts must never wobble.

## Layout

One shell holds every protected view: centered content at `max-w-7xl` (1280px), horizontal padding 20px on phones, 34px on tablets, 40px on desktops, vertical rhythm 24–32px. Forms and filters use responsive grids (single column on phones, up to four across on desktop); the project register keeps one flat filter row on desktop and collapses secondary filters behind a `Filters` disclosure with an active-count on phones. The register switches through the `@4xl/content` query on the named `@container/content` on `<main>`: below 56rem of container content width the dense register table becomes labelled record cards; the sort, filter, and pagination path stays identical. Cards breathe on a 32px desktop / 16px mobile spacing token.

### Named Rules

**The Shell Holds Rule.** Every protected view lives inside the same centered shell and spacing rhythm; full-bleed is reserved for brand moments, never for workflows.

## Elevation & Depth

Flat by default, glowing by exception. Depth comes from tonal layering (paper ground, white cards, translucent dark cards) and hairline rings (`ring-1 ring-foreground/5`), not from resting shadows. Cards rest flat with a hairline ring; dialogs float on `shadow-md` with a 10% foreground ring; dropdowns and popovers use mid shadows. The amber glow vocabulary (primary glow, secondary glow, headline accent, CTA breath) belongs to brand and confirmation moments only.

### Shadow Vocabulary

- **Card rest** (`shadow-sm` + `ring-1 ring-foreground/5`): the quietest lift that still reads as a surface.
- **Dialog float** (`shadow-md` + `ring-1 ring-foreground/10`): overlays above page content.
- **Primary glow** (`0 0 18px rgb(255 184 0 / 0.45)` in dark, `0 0 12px rgb(255 204 0 / 50%)` in light): CTA breath and confirmed fire states only.
- **Headline accent** (`text-shadow: 0 0 60px rgb(255 184 0 / 0.45)`): static display glow on brand surfaces, never animated.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest; shadow and glow arrive only as a response to state (hover, focus, confirmation). Calm zones opt out of even hover lift.

## Shapes

One radius base (10px, `--radius: 0.625rem`) scales the whole system: 6 / 8 / 10 / 14 / 18 / 22 / 26px steps, full pill at 9999px. Buttons and inputs sit at 14px (`rounded-xl`) — friendly, never sharp, never bubbly. Cards and dialogs sit at 18px (`rounded-2xl`). Pills (`rounded-full`) are reserved for seals and the ember accent badge. Clipping is rectangular with rounded corners throughout; there are no circles except status dots and avatars, no sharp 0px corners except contiguous table headers. The claim-band card carries a single brand spine (a vertical gold bar) instead of rounded decoration.

### Named Rules

**The Fourteen-Eighteen Rule.** Interactive controls round at 14px, containing surfaces at 18px. Anything rounder must earn the pill; anything sharper must earn the edge.

## Components

### Buttons

- **Character:** decisive stamps in the incumbent code, migrating toward a soft guiding voice: sentence case for new controls, uppercase micro-labels where they already exist.
- **Shape:** 14px radius (`rounded-xl`) at standard sizes. Compact 28px text buttons use `rounded-lg` so they don't read as pills. Heights are 28 / 36 / 40 / 44px across xs / sm / default / lg, with icon-only squares to match.
- **Primary:** Erasmus Blue ground, white text, deepens on hover; amber-on-brown in dark vibes.
- **Secondary / Outline / Ghost:** tonal fills and hairline borders; ghost is text-only until hover.
- **Outline buttons:** the shared `outline` variant uses a half-pixel border, with a softened brand color in dark themes so the line stays quiet even on displays that round it to one pixel.
- **Destructive:** solid signal-red block for the one dangerous act; `outline-destructive` (hairline + red text) for repeated row actions so lists never compete with the primary act.
- **Link:** not a button shape at all — prose-colored, always underlined in Seal Gold, sentence case, wrapping; the only button allowed to hold a sentence.
- **Hover / Focus:** gentle tonal shifts; focus always visible via ring plus border (`focus-visible:ring-2`), 3–4px offset outlines on links. Pressed buttons settle 1px (`translate-y-px`).

### Cards

- **Character:** quiet containers with one dramatic exception — hovered cards lift 2px and catch a fire border over 220ms.
- **Corner Style:** 18px (`rounded-2xl`), overflow hidden, hairline ring.
- **Background:** Card White in light, 5%-white translucent in darks; padding 32px desktop / 16px mobile via a spacing token.
- **Variants:** default (hover lift + amber wash from top), `ember` (permanent fire border + amber wash for confirmed states), `action` (borderless muted document card), `claim-band` (dark band with gold spine for claim status).

### Badges

- **Character:** whispered metadata — 10px semibold uppercase micro-labels by default.
- **Ember Pill:** the exception that proves the rule — pill-shaped, gold-bordered, glass-edged, for brand seals (e.g. theme names). Text follows the theme foreground.
- **Claim Status:** sentence-case, wrapping, large — status must read as a sentence, never as a stamp.

### Inputs / Fields

- **Style:** 14px radius, translucent input fill (`input/30`), hairline input border, 40px default height (44px accounting variant), 16px body text (14px from `md` up).
- **Focus:** border shifts to ring color plus a soft 30% ring; never a bare outline change.
- **Error / Disabled:** destructive border + tinted ring for invalid; 50% opacity and no pointer events when disabled.

### Dialogs & Popovers

- **Character:** calm interruptions — centered, 18px radius, popover ground, mid shadow, 24px padding, fade-and-zoom entrance over 100ms.
- **Focus:** trapped while open; closing returns focus to the trigger. Destructive dialogs name the payload in the title surface, never inside the action buttons.

### Navigation

- **Sidebar:** theme-tinted ground with primary-marked active entries; collapsible to icon rail; secondary entries stay text-only.
- **Breadcrumbs and tabs:** prose-colored text navigation with gold-underline actives; keyboard reachable with visible focus throughout.
- **Links in content:** always the `link-prose` treatment — theme link color, gold underline on hover/focus, never a bare color shift.

### Project Register (signature pattern)

- **Character:** one table, two compositions — dense tabular register at or above the `@4xl/content` threshold (56rem of `<main>` container content width), labelled record cards below that threshold, same data path.
- **Desktop:** tinted header row, non-wrapping tabular dates, wide name column, truncation with full titles on hover.
- **Cards:** each row becomes a bordered card; the name leads as a title row, remaining cells read as label/value pairs from `data-label`.
- **Footer:** result count ("Showing X of Y") plus pager; the empty state offers a `Clear filters` recovery.

### Project Workspace

- The Project name uses the register's page-title scale; the breadcrumb carries the Hosted/Partner context. Archived status stays beside the title.
- Schedule and location lead into a compact, divided metric strip with sentence-case labels and tabular values. The Hosted Participants link sits with the Project facts and wraps below them on narrow screens.
- The partnership section contains the relevant work: Hosted rows pair each Partner with Claim status and available review links; the Partner view groups Hosting identity, assignment dates, and links to its own workspaces.

## Do's and Don'ts

### Implementation source of truth

The running Cost Tracker UI and its shared `src/components/ui/` primitives take precedence over examples in this document. Compose those shadcn primitives and their existing variants first; use Tailwind utilities for responsive layout, spacing, and typography, and semantic theme classes backed by `src/app/globals.css`. Do not add feature stylesheets, handwritten selectors, or inline style objects for page polish. Reserve custom CSS for shared theme or primitive behavior that Tailwind composition cannot express, and keep that exception in the design system rather than in a route.

### Do:

- **Do** keep button and dialog copy fixed and compact; render project, organization, and user names only in dedicated truncating surfaces (titles, title attributes), never inside controls.
- **Do** use the `link-prose` utility (or the Button `link` variant) for every content link — gold underline, generous focus, always visible affordance.
- **Do** mark numerals tabular in data (`tabular-nums`) and keep dates non-wrapping.
- **Do** respect `prefers-reduced-motion` — every animation ships a gentler variant, and calm zones opt out of hover motion entirely.
- **Do** animate opacity, transform, and background-color only; the CTA breath lives on a blurred `::before` layer so only opacity animates.

### Don't:

- **Don't** interpolate payload data into button labels, dialog titles-as-actions, or any control whose width must stay predictable.
- **Don't** use display type (Inter Black hero sizes), aura washes, or the CTA breath inside staff workflows — they belong to brand surfaces.
- **Don't** animate `box-shadow` (it janks under load) or bare-element selectors (navigation needs no exemption list).
- **Don't** let the spec's unused vibes (`plum`, `royal`) back in — the code owns four themes: light, midnight, violet, dark.
- **Don't** invent one-off tokens; stop at what is reused. The frontmatter is normative — a value lives in exactly one place.
