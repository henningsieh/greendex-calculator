// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  fromCalendarDate,
  fromDateInputValue,
  spanInDays,
  toCalendarDate,
  toDateInputValue,
} from "./input";

describe("date input values", () => {
  it("round-trips a UTC midnight without shifting the day", () => {
    const date = new Date("2027-04-03T00:00:00.000Z");
    expect(toDateInputValue(date)).toBe("2027-04-03");
    expect(fromDateInputValue("2027-04-03")).toEqual(date);
  });

  it("accepts the DateInput forms the formatter accepts", () => {
    expect(toDateInputValue("2027-04-03T00:00:00.000Z")).toBe("2027-04-03");
    expect(toDateInputValue(Date.parse("2027-04-03T00:00:00.000Z"))).toBe(
      "2027-04-03",
    );
  });

  it("returns an empty string for empty or unusable values", () => {
    expect(toDateInputValue(undefined)).toBe("");
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue("not-a-date")).toBe("");
    expect(toDateInputValue(new Date(Number.NaN))).toBe("");
  });

  it("rejects empty, malformed, and impossible input values", () => {
    expect(fromDateInputValue(undefined)).toBeUndefined();
    expect(fromDateInputValue("")).toBeUndefined();
    expect(fromDateInputValue("03/04/2027")).toBeUndefined();
    expect(fromDateInputValue("2027-02-30")).toBeUndefined();
  });

  it("adapts a stored UTC midnight to a local calendar day", () => {
    const calendarDate = toCalendarDate("2027-04-03T00:00:00.000Z");
    expect(calendarDate?.getFullYear()).toBe(2027);
    expect(calendarDate?.getMonth()).toBe(3);
    expect(calendarDate?.getDate()).toBe(3);
    expect(calendarDate?.getHours()).toBe(0);
  });

  it("adapts a local calendar selection back to a stored UTC midnight", () => {
    const stored = fromCalendarDate(new Date(2027, 3, 3));
    expect(stored?.toISOString()).toBe("2027-04-03T00:00:00.000Z");
  });
});

describe("inclusive day spans", () => {
  it("counts the same day as one day", () => {
    expect(
      spanInDays(
        new Date("2027-04-03T00:00:00.000Z"),
        new Date("2027-04-03T00:00:00.000Z"),
      ),
    ).toBe(1);
  });

  it("counts both endpoints", () => {
    expect(
      spanInDays(
        new Date("2027-04-03T00:00:00.000Z"),
        new Date("2027-04-17T00:00:00.000Z"),
      ),
    ).toBe(15);
  });

  it("returns zero for reversed or unusable spans", () => {
    expect(
      spanInDays(
        new Date("2027-04-17T00:00:00.000Z"),
        new Date("2027-04-03T00:00:00.000Z"),
      ),
    ).toBe(0);
    expect(spanInDays("not-a-date", "2027-04-03")).toBe(0);
  });
});
