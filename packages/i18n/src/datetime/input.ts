import { Temporal } from "temporal-polyfill";

import type { DateInput } from "./format";

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function asDate(value: DateInput | null | undefined): Date | undefined {
  if (value === null || value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Stored dates are UTC midnights; their calendar day is the UTC day. */
function plainDateFromStored(
  value: DateInput | null | undefined,
): Temporal.PlainDate | undefined {
  const date = asDate(value);
  if (!date) return undefined;
  return Temporal.PlainDate.from({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function plainDateFromCalendar(
  value: Date | null | undefined,
): Temporal.PlainDate | undefined {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return undefined;
  return Temporal.PlainDate.from({
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
  });
}

function storedDateFromPlain(date: Temporal.PlainDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

function calendarDateFromPlain(date: Temporal.PlainDate): Date {
  return new Date(date.year, date.month - 1, date.day);
}

/**
 * The UTC calendar day a native `<input type="date">` expects.
 *
 * Project dates are stored as UTC midnights, so this deliberately reads the
 * UTC day rather than the browser's local day.
 */
export function toDateInputValue(value: DateInput | null | undefined): string {
  return plainDateFromStored(value)?.toString() ?? "";
}

/**
 * Parse a native date input's `YYYY-MM-DD` value as a UTC midnight.
 *
 * Returns `undefined` for an empty, malformed, or impossible date (for example
 * `2027-02-30`) so callers clear the field instead of storing a normalized
 * surprise.
 */
export function fromDateInputValue(
  value: string | null | undefined,
): Date | undefined {
  if (!value || !DATE_INPUT_PATTERN.test(value)) return undefined;
  try {
    const date = Temporal.PlainDate.from(value);
    return date.toString() === value ? storedDateFromPlain(date) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A stored UTC-midnight date as a local-midnight `Date` for calendar widgets
 * such as react-day-picker, which render calendar days in local time.
 */
export function toCalendarDate(
  value: DateInput | null | undefined,
): Date | undefined {
  const date = plainDateFromStored(value);
  return date ? calendarDateFromPlain(date) : undefined;
}

/** A local calendar selection as a stored UTC midnight. */
export function fromCalendarDate(
  value: Date | null | undefined,
): Date | undefined {
  const date = plainDateFromCalendar(value);
  return date ? storedDateFromPlain(date) : undefined;
}

/**
 * Inclusive number of calendar days between two dates: the same day is one
 * day, 3–17 April is fifteen days. Returns `0` for an unusable or reversed
 * span.
 */
export function spanInDays(start: DateInput, end: DateInput): number {
  const first = plainDateFromStored(start);
  const last = plainDateFromStored(end);
  if (!first || !last) return 0;
  if (Temporal.PlainDate.compare(first, last) > 0) return 0;
  return last.since(first, { largestUnit: "days" }).days + 1;
}
