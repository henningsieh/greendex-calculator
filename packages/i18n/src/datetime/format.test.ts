// @vitest-environment node

import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "@greendex/config/languages";
import { describe, expect, it, vi } from "vitest";

import { createDateFormatter } from "./format";
import { dateFormats, type DateFormatName } from "./formats";

const timeZone = "UTC";
const instant = "2025-12-28T14:30:05Z";

const enGb = createDateFormatter({ locale: "en-GB", timeZone });
const german = createDateFormatter({ locale: "de", timeZone });
const slovenian = createDateFormatter({ locale: "sl", timeZone });

/**
 * Every named format in the three locales the project writes itself: British
 * English, German, and Slovenian. `satisfies` makes this table a compile-time
 * check, so adding a name to `dateFormats` without a row here is a type error.
 *
 * `sl` is Slovenian. It used to be `si`, which CLDR resolves to Sinhala, so these
 * rows also guard the locale code itself.
 */
const formatters = {
  "en-GB": enGb,
  de: german,
  sl: slovenian,
} as const;

type ReviewedLocale = keyof typeof formatters;

const conventions = {
  "en-GB": {
    "date.short": "28/12/2025",
    "date.medium": "28 Dec 2025",
    "date.long": "28 December 2025",
    "date.full": "Sunday, 28 December 2025",
    "date.numeric": "28/12/2025",
    "date.monthShort": "Dec",
    "date.monthLong": "December",
    "dateTime.short": "28 Dec 2025, 14:30",
    "dateTime.medium": "28 Dec 2025, 14:30:05",
    "time.short": "14:30",
    "time.seconds": "14:30:05",
  },
  de: {
    "date.short": "28.12.25",
    "date.medium": "28.12.2025",
    "date.long": "28. Dezember 2025",
    "date.full": "Sonntag, 28. Dezember 2025",
    "date.numeric": "28.12.2025",
    "date.monthShort": "Dez",
    "date.monthLong": "Dezember",
    "dateTime.short": "28.12.2025, 14:30",
    "dateTime.medium": "28.12.2025, 14:30:05",
    "time.short": "14:30",
    "time.seconds": "14:30:05",
  },
  sl: {
    "date.short": "28. 12. 2025",
    "date.medium": "28. dec. 2025",
    "date.long": "28. december 2025",
    "date.full": "nedelja, 28. december 2025",
    "date.numeric": "28. 12. 2025",
    "date.monthShort": "dec.",
    "date.monthLong": "december",
    "dateTime.short": "28. dec. 2025, 14:30",
    "dateTime.medium": "28. dec. 2025, 14:30:05",
    "time.short": "14:30",
    "time.seconds": "14:30:05",
  },
} satisfies Record<ReviewedLocale, Record<DateFormatName, string>>;

describe("named formats", () => {
  it.each(Object.keys(dateFormats) as DateFormatName[])(
    "renders %s in every reviewed locale",
    (name) => {
      for (const locale of Object.keys(formatters) as ReviewedLocale[]) {
        expect(
          formatters[locale].format(instant, name),
          `${locale} ${name}`,
        ).toBe(conventions[locale][name]);
      }
    },
  );

  it("defaults to the medium date", () => {
    expect(enGb.format(instant)).toBe("28 Dec 2025");
  });

  it.each(LANGUAGE_CODES)("formats every configured locale %s", (locale) => {
    const formatter = createDateFormatter({ locale, timeZone });
    expect(formatter.format(instant)).not.toBe("");
  });

  it("formats the default locale of the application", () => {
    expect(DEFAULT_LANGUAGE).toBe("en-GB");
    expect(enGb.format(instant, "date.long")).toBe("28 December 2025");
  });
});

describe("input values", () => {
  const date = new Date(instant);

  it("treats Date, timestamp, and string as the same instant", () => {
    const fromDate = enGb.format(date);
    expect(enGb.format(date.getTime())).toBe(fromDate);
    expect(enGb.format(instant)).toBe(fromDate);
  });

  it("returns an empty string for unusable values", () => {
    expect(enGb.format("not a date")).toBe("");
    expect(enGb.format(new Date("invalid"))).toBe("");
    expect(enGb.range(instant, "not a date")).toBe("");
  });
});

describe("ranges", () => {
  // CLDR decides the separator. Current ICU emits thin spaces around the en dash and
  // CLDR 49 moved to a plain space, so the formatter canonicalises to a plain space.
  const span = " \u2013 ";

  it("collapses a span that shares a month", () => {
    expect(enGb.range("2025-12-03T00:00:00Z", "2025-12-28T00:00:00Z")).toBe(
      `3${span}28 Dec 2025`,
    );
  });

  it("keeps both dates when the span crosses a month", () => {
    expect(german.range("2025-12-28T00:00:00Z", "2026-01-03T00:00:00Z")).toBe(
      `28.12.2025${span}03.01.2026`,
    );
  });

  it("accepts a named format", () => {
    expect(
      enGb.range("2025-12-03T00:00:00Z", "2025-12-28T00:00:00Z", "date.long"),
    ).toBe(`3${span}28 December 2025`);
  });
});

describe("runtime-stable output", () => {
  const typographicSpaces = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/u;

  it.each(LANGUAGE_CODES)(
    "emits no typographic space for any format in %s",
    (locale) => {
      const formatter = createDateFormatter({ locale, timeZone });
      for (const name of Object.keys(
        dateFormats,
      ) as (keyof typeof dateFormats)[]) {
        expect(formatter.format(instant, name)).not.toMatch(typographicSpaces);
        expect(formatter.pattern()).not.toMatch(typographicSpaces);
      }
      expect(
        formatter.relative(instant, { now: "2025-10-20T14:30:05Z" }),
      ).not.toMatch(typographicSpaces);
    },
  );

  it("pins the range separator across ICU versions", () => {
    // Node 24 renders this with U+2009 and current Chrome with U+0020; the
    // formatter must produce the same bytes in both.
    expect(german.range("2025-01-01T00:00:00Z", "2025-12-31T00:00:00Z")).toBe(
      "01.01. \u2013 31.12.2025",
    );
    expect(
      german.range("2025-01-01T00:00:00Z", "2025-12-31T00:00:00Z"),
    ).not.toMatch(typographicSpaces);
  });

  it("keeps the en dash and every visible character", () => {
    expect(enGb.range("2025-12-03T00:00:00Z", "2025-12-28T00:00:00Z")).toBe(
      "3 \u2013 28 Dec 2025",
    );
  });
});

describe("relative time", () => {
  it("derives the largest meaningful unit", () => {
    const now = instant;
    expect(enGb.relative("2025-12-25T14:30:05Z", { now })).toBe("3 days ago");
    expect(enGb.relative("2025-12-28T11:30:05Z", { now })).toBe("3 hours ago");
    expect(enGb.relative("2025-10-20T14:30:05Z", { now })).toBe("2 months ago");
    expect(enGb.relative("2024-12-20T14:30:05Z", { now })).toBe("1 year ago");
  });

  it('says "now" inside the first minute', () => {
    expect(enGb.relative(instant, { now: instant })).toBe("now");
    expect(german.relative(instant, { now: instant })).toBe("jetzt");
    expect(slovenian.relative(instant, { now: instant })).toBe("zdaj");
  });

  it("formats a future value in the future tense", () => {
    expect(enGb.relative("2026-01-04T14:30:05Z", { now: instant })).toBe(
      "in 1 week",
    );
  });

  it("honours an explicit unit", () => {
    expect(
      enGb.relative("2025-12-25T14:30:05Z", { unit: "hour", now: instant }),
    ).toBe("72 hours ago");
  });

  it("returns an empty string for an unusable reference", () => {
    expect(enGb.relative(instant, { now: "not a date" })).toBe("");
  });
});

describe("entry-field pattern", () => {
  it("follows the locale's own field order", () => {
    expect(enGb.pattern()).toBe("DD/MM/YYYY");
    expect(german.pattern()).toBe("DD.MM.YYYY");
    expect(slovenian.pattern()).toBe("DD. MM. YYYY");
  });

  it("differs from a month-first locale", () => {
    expect(createDateFormatter({ locale: "en-US", timeZone }).pattern()).toBe(
      "MM/DD/YYYY",
    );
  });
});

describe("time zone", () => {
  it("projects the same instant into the configured zone", () => {
    const berlin = createDateFormatter({
      locale: "de",
      timeZone: "Europe/Berlin",
    });
    // 14:30 UTC is 15:30 in Berlin in December.
    expect(berlin.format(instant, "time.short")).toBe("15:30");
    expect(enGb.format(instant, "time.short")).toBe("14:30");
  });

  it("renders in UTC and names the setting when the zone is unknown", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unknown = createDateFormatter({ locale: "en-GB", timeZone: "Nowhere" });
    expect(unknown.format(instant, "time.short")).toBe("14:30");
    expect(unknown.format(instant, "date.medium")).toBe("28 Dec 2025");
    // One warning per unknown zone, not one per formatted row.
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Unknown time zone "Nowhere"; rendering dates in UTC.',
    );
    warn.mockRestore();
  });
});

describe("formatter reuse", () => {
  it("constructs one Intl formatter per locale, zone, and name", async () => {
    // A fresh module instance, so the process-wide cache starts empty regardless of
    // the order the rest of this file ran in.
    vi.resetModules();
    const fresh = await import("./format");
    const spy = vi.spyOn(Intl, "DateTimeFormat");

    const formatter = fresh.createDateFormatter({
      locale: "fr",
      timeZone: "UTC",
    });
    formatter.format(instant, "date.long");
    formatter.format(instant, "date.long");
    formatter.format(instant, "date.long");

    // Three lookups, one construction.
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
