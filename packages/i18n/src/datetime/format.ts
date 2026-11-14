import { dateFormats, type DateFormatName } from "./formats";

/**
 * What the formatter accepts: a `Date`, an epoch-millisecond timestamp, or a date
 * string. Drizzle `timestamp` columns arrive as `Date`, serialized procedure
 * values as strings.
 */
export type DateInput = Date | number | string;

export type RelativeTimeUnit =
  | "year"
  | "month"
  | "week"
  | "day"
  | "hour"
  | "minute"
  | "second";

export type DateFormatterConfig = {
  /** BCP-47 tag of the active locale, e.g. `en-GB`, passed to `Intl` unchanged. */
  locale: string;
  /**
   * IANA time zone every value is projected into. Required: the same row must not
   * render differently on the server and in the browser.
   */
  timeZone: string;
};

export type RelativeTimeOptions = {
  /** Reference instant. Defaults to the current time. */
  now?: DateInput;
  /** Force a unit instead of deriving the largest meaningful one. */
  unit?: RelativeTimeUnit;
};

export type DateFormatter = {
  readonly locale: string;
  readonly timeZone: string;
  /** Format one value with a named format. Returns `""` for an unusable value. */
  format(value: DateInput, name?: DateFormatName): string;
  /**
   * Format a span as one localized range, e.g. `3 – 28 Dec 2025` rather than
   * `3 Dec 2025 – 28 Dec 2025`. Returns `""` if either end is unusable.
   */
  range(start: DateInput, end: DateInput, name?: DateFormatName): string;
  /** Format a value relative to `now`, e.g. `3 days ago`. Returns `""` if unusable. */
  relative(value: DateInput, options?: RelativeTimeOptions): string;
  /** Placeholder for an empty date field in the locale's own order, e.g. `DD/MM/YYYY`. */
  pattern(): string;
};

const MILLISECONDS_PER_SECOND = 1000;
const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
/** Approximation: relative output never claims more precision than a bucket. */
const MONTH = DAY * (365 / 12);
const YEAR = 365 * DAY;

const UNIT_SECONDS: Record<RelativeTimeUnit, number> = {
  second: SECOND,
  minute: MINUTE,
  hour: HOUR,
  day: DAY,
  week: WEEK,
  month: MONTH,
  year: YEAR,
};

const FALLBACK_TIME_ZONE = "UTC";

/** Sample date for building an entry-field placeholder; only the field order matters. */
const PATTERN_SAMPLE = Date.UTC(2000, 0, 1);

const PLACEHOLDER_SEGMENTS: Partial<
  Record<Intl.DateTimeFormatPartTypes, string>
> = { day: "DD", month: "MM", year: "YYYY" };

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
/** Zone keys already reported, so a bad configuration warns once and not per row. */
const warnedTimeZones = new Set<string>();
const relativeTimeFormats = new Map<string, Intl.RelativeTimeFormat>();

/**
 * Space characters CLDR puts inside a pattern. CLDR 49 replaced the typographic
 * spaces around a range's en dash with a plain space, so Node (CLDR 48) and the
 * browser (CLDR 49) differ by one invisible character and React reports a
 * hydration mismatch. Every separator becomes U+0020 — the direction CLDR is
 * moving — so no invisible character can differ across runtimes again. The en dash
 * and the surrounding text stay untouched. A range that must not wrap belongs in
 * `whitespace-nowrap`, not in a no-break character that differs per runtime.
 */
const SPACE_SEPARATORS = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

function canonicalize(text: string): string {
  return text.replace(SPACE_SEPARATORS, " ");
}

function toDate(value: DateInput): Date | undefined {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateTimeFormatFor(
  locale: string,
  timeZone: string,
  name: DateFormatName,
): Intl.DateTimeFormat {
  const key = `${locale}\u0000${timeZone}\u0000${name}`;
  const cached = dateTimeFormats.get(key);
  if (cached) return cached;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale, {
      ...dateFormats[name],
      timeZone,
    });
  } catch {
    // An unknown zone comes from configuration, not from data. Rendering in UTC
    // keeps the surface usable, and the warning names the setting to correct. An
    // unsupported locale is a programming error and is allowed to throw on the retry.
    if (!warnedTimeZones.has(timeZone)) {
      warnedTimeZones.add(timeZone);
      console.warn(
        `Unknown time zone "${timeZone}"; rendering dates in ${FALLBACK_TIME_ZONE}.`,
      );
    }
    formatter = new Intl.DateTimeFormat(locale, {
      ...dateFormats[name],
      timeZone: FALLBACK_TIME_ZONE,
    });
  }
  dateTimeFormats.set(key, formatter);
  return formatter;
}

function relativeTimeFormatFor(
  locale: string,
  numeric: "always" | "auto",
): Intl.RelativeTimeFormat {
  const key = `${locale}\u0000${numeric}`;
  const cached = relativeTimeFormats.get(key);
  if (cached) return cached;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric });
  relativeTimeFormats.set(key, formatter);
  return formatter;
}

function resolveRelativeUnit(seconds: number): RelativeTimeUnit {
  const magnitude = Math.abs(seconds);
  if (magnitude < MINUTE) return "second";
  if (magnitude < HOUR) return "minute";
  if (magnitude < DAY) return "hour";
  if (magnitude < WEEK) return "day";
  if (magnitude < MONTH) return "week";
  if (magnitude < YEAR) return "month";
  return "year";
}

/**
 * Build the localized formatter for one locale and time zone.
 *
 * The repository's only `Intl` date call site, so conventions stay in CLDR instead
 * of in components and each locale/zone/name keeps one `Intl.DateTimeFormat`.
 */
export function createDateFormatter({
  locale,
  timeZone,
}: DateFormatterConfig): DateFormatter {
  return {
    locale,
    timeZone,
    format(value, name = "date.medium") {
      const date = toDate(value);
      if (!date) return "";
      return canonicalize(dateTimeFormatFor(locale, timeZone, name).format(date));
    },
    range(start, end, name = "date.medium") {
      const from = toDate(start);
      const to = toDate(end);
      if (!from || !to) return "";
      return canonicalize(
        dateTimeFormatFor(locale, timeZone, name).formatRange(from, to),
      );
    },
    relative(value, options = {}) {
      const date = toDate(value);
      const now = options.now === undefined ? new Date() : toDate(options.now);
      if (!date || !now) return "";

      const seconds = (date.getTime() - now.getTime()) / MILLISECONDS_PER_SECOND;
      const unit = options.unit ?? resolveRelativeUnit(seconds);

      // `numeric: "auto"` yields "yesterday" or "now", but only for whole values,
      // so it is limited to the sub-minute bucket where "now" is the whole point.
      const numeric = unit === "second" ? "auto" : "always";
      const amount = Math.round(seconds / UNIT_SECONDS[unit]);

      return canonicalize(
        relativeTimeFormatFor(locale, numeric).format(amount, unit),
      );
    },
    pattern() {
      const sample = new Date(PATTERN_SAMPLE);
      return canonicalize(
        dateTimeFormatFor(locale, timeZone, "date.numeric")
          .formatToParts(sample)
          .map((part) => PLACEHOLDER_SEGMENTS[part.type] ?? part.value)
          .join(""),
      );
    },
  };
}
