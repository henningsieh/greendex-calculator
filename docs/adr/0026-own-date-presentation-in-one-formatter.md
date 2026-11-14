---
status: accepted
supersedes: []
---

# One Date Presenter, and Locale Codes That Are Full BCP-47 Tags

## Context

Sixteen surfaces formatted dates and times, three different ways. Cost Tracker pinned four hand-written `Intl.DateTimeFormat` instances to `"en-GB"` and UTC, so German users read `28 Dec 2025`. Calculator passed ad-hoc `Intl` option objects to next-intl, and in four places used `Date.prototype.toLocale*`, which reads the host locale and the host zone: those strings differ between the server render and the browser hydration, and on the server they differ per deployment.

Two locale codes were also wrong for what the application means. `en` is not a neutral international tag; CLDR resolves it to US English, which is why somebody had already hard-coded `en-GB` in Cost Tracker. `si` is Sinhala in ISO 639-1, so the Slovenian catalogue rendered dates as `2025 උඳුවප් 28`, numbers as `1,234,567.89`, and country names in Sinhala script. `apps/cost-tracker/src/components/eu-country-names.ts` already contained a private `locale === "si" ? "sl" : locale` alias as a local workaround for it.

Temporal was considered as the replacement. Temporal is Stage 4 and native in Chrome 144, Edge 144, Firefox 139, and Node 26, but not in Safari stable, and not in the Node 24 runtime this repository pins. Temporal also does not format: `Temporal.PlainDate.prototype.toLocaleString` delegates to `Intl.DateTimeFormat`, because localized month names exist only in ICU/CLDR. Adopting Temporal today would add a polyfill on both server and client without removing a single `Intl` call.

## Decision

Date presentation has one module, `packages/i18n/src/datetime/`. It is the repository's only `Intl` date call site.

It exposes named formats (`date.medium`, `date.long`, `dateTime.short`, `time.seconds`, …) built on CLDR's `dateStyle`/`timeStyle`, plus a locale-ordered entry pattern. Callers pick a name; they never pass `Intl` options. `useDateFormat()` reads the request locale and zone from the provider, `getDateFormat()` serves Server Components and route handlers, and `createDateFormatter({locale, timeZone})` serves code without a request, such as email rendered from a background job.

Every formatter requires an explicit IANA time zone. A result must not depend on the server's or the browser's own zone.

Locale codes are full BCP-47 tags. The configured set is `en-GB`, `de`, `es`, `fr`, `it`, `nl`, `sl`. The code reaches `Intl` unchanged, so no alias layer exists anywhere, and the switcher's flag follows the language entry's `countryCode`.

`greendex/no-raw-date-formatting` rejects `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, `Intl.DurationFormat`, and `Date.prototype.toLocaleString`/`toLocaleDateString`/`toLocaleTimeString` outside the module. The guard's own tests live in `scripts/oxlint-datetime.test.ts` and run with the other tooling suites in `test:unit`; they are not part of `pnpm run lint` (corrected before landing: an earlier draft of this record wired them into the lint chain).

## Considered Options

A per-call-options helper was rejected. It would centralise the `Intl` call without centralising the formats, so screens would keep inventing option sets.

Relying on `next-intl`'s `formats` configuration was rejected. It would place the same registry in two app request configurations and pass it through two providers, and `format.dateTime` accepts only `Date | number`, which blocks the Temporal seam below.

Adding `temporal-polyfill` now was rejected. It costs roughly 20 kB gzipped in the browser, it patches the global `Intl.DateTimeFormat` to accept its objects, and it does not change a single rendered string. Temporal changes the value model, not the presentation; it is worth paying for when date arithmetic justifies it, not for display.

Renaming only `en` and leaving `si` was rejected. Both are the same defect: a code that does not name the language it labels. Fixing one and aliasing the other would preserve the workaround the codebase was already carrying.

## Consequences

English dates change from `28 Dec 2025` to the same `28 Dec 2025` in Cost Tracker, and from US month-first ordering to `28 Dec 2025` in Calculator. Slovenian renders Slovenian dates, numbers, currency, and country names. The `si`-to-`sl` alias and its test are gone.

URLs change with the codes: `/en/…` becomes `/en-GB/…` and `/si/…` becomes `/sl/…`. Message catalogues move to `en-GB` and `sl`. Routing, navigation, the sitemap, and the documentation app's language list derive from `LANGUAGE_CODES` and needed no separate change. No locale is persisted in the database.

Formatter output is canonicalised to plain spaces. Node 24 ships ICU 78 with CLDR 48 and renders a date range as `01.01.\u2009–\u200931.12.2025`; current Chrome ships CLDR 49 and renders `01.01. – 31.12.2025`. One invisible character, one hydration mismatch. CLDR is moving toward the plain space, so the module normalises every space separator to it, once, for every method. Component-level `String.replace` cannot cover the surfaces that do not know they format a date, and it loses the en dash's neighbours per call site. Pinning CLDR would fix the class of divergence rather than this instance, and was rejected as disproportionate: it means shipping a pinned `@formatjs/intl-datetimeformat` dataset, hundreds of kilobytes, to seven locales for invisible characters. If output must ever be byte-identical across runtimes for a reason beyond hydration, pinning is the next step, not the first.

`packages/i18n` now depends on React as a peer, because it exports its first hook.

The formatter accepts `Date`, an epoch-millisecond number, or a date string, which covers Drizzle `timestamp` columns and serialized procedure values. Because every caller goes through one module, promoting calendar-date columns to `Temporal.PlainDate` and audit columns to `Temporal.Instant` later is a change inside `format.ts` plus the persistence seam, not a change at sixteen call sites. That is the seam this decision leaves open.
