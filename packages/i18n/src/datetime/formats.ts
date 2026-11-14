/**
 * Named date and time formats.
 *
 * The names are the only place that decides how a date looks. Screens pick a name
 * instead of passing `Intl` options, so the same concept renders identically
 * everywhere and a change lands in one file.
 *
 * `dateStyle`/`timeStyle` are the CLDR styles (`full`, `long`, `medium`, `short`)
 * and are the preferred controls: they encode a locale's own conventions instead
 * of imposing an order. Component options exist only where no style fits — a
 * numeric field that has to round-trip, a month label, a clock that shows seconds.
 */
export const dateFormats = {
  /** `28/12/25` — compact, only where space is tight. */
  "date.short": { dateStyle: "short" },
  /** `28 Dec 2025` — tables, lists, cards. */
  "date.medium": { dateStyle: "medium" },
  /** `28 December 2025` — prose and detail headings. */
  "date.long": { dateStyle: "long" },
  /** `Sunday, 28 December 2025` — the most explicit form. */
  "date.full": { dateStyle: "full" },
  /** `28/12/2025` — fixed field order for editable or round-tripping inputs. */
  "date.numeric": { day: "2-digit", month: "2-digit", year: "numeric" },
  /** `Dec` — month name without a day. */
  "date.monthShort": { month: "short" },
  /** `December` — month name without a day. */
  "date.monthLong": { month: "long" },
  /** `28 Dec 2025, 14:30` — audit trails and "last changed" stamps. */
  "dateTime.short": { dateStyle: "medium", timeStyle: "short" },
  /** `28 Dec 2025, 14:30:59` — permalinks and debugging surfaces. */
  "dateTime.medium": { dateStyle: "medium", timeStyle: "medium" },
  /** `14:30` — clock time only. */
  "time.short": { timeStyle: "short" },
  /** `14:30:59` — clock time with seconds, always 24-hour for comparability. */
  "time.seconds": {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    second: "2-digit",
  },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateFormatName = keyof typeof dateFormats;
