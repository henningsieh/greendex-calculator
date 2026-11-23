import type { DateInput } from "./format";

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function asDate(value: DateInput | null | undefined): Date | undefined {
  if (value === null || value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * The UTC calendar day a native `<input type="date">` expects.
 *
 * Project dates are stored as UTC midnights, so this deliberately reads the
 * UTC day rather than the browser's local day.
 */
export function toDateInputValue(value: DateInput | null | undefined): string {
  const date = asDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
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
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || toDateInputValue(date) !== value)
    return undefined;
  return date;
}

/**
 * Inclusive number of calendar days between two dates: the same day is one
 * day, 3–17 April is fifteen days. Returns `0` for an unusable or reversed
 * span.
 */
export function spanInDays(start: DateInput, end: DateInput): number {
  const first = asDate(start);
  const last = asDate(end);
  if (!first || !last) return 0;
  const days = Math.round((last.getTime() - first.getTime()) / MS_PER_DAY);
  return days < 0 ? 0 : days + 1;
}
