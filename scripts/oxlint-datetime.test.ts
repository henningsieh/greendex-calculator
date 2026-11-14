import { describe, expect, it } from "vitest";

import { lint } from "./oxlint-fixture";

const scopedFile = "apps/calculator/src/features/example.tsx";

const rules = (source: string, path = scopedFile) =>
  lint({ source, path }).diagnostics.filter((diagnostic) =>
    diagnostic.code.startsWith("greendex(no-raw-date-formatting)"),
  );

describe("greendex/no-raw-date-formatting", () => {
  it.each(["DateTimeFormat", "RelativeTimeFormat", "DurationFormat"])(
    "reports Intl.%s",
    (name) => {
      expect(rules(`export const f = new Intl.${name}("en-GB");`)).toHaveLength(
        1,
      );
    },
  );

  it.each(["toLocaleDateString", "toLocaleString", "toLocaleTimeString"])(
    "reports %s",
    (name) => {
      expect(rules(`export const s = new Date().${name}();`)).toHaveLength(1);
    },
  );

  it("leaves the formatter module free to own the Intl calls", () => {
    expect(
      rules(
        'export const f = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });',
        "packages/i18n/src/datetime/format.ts",
      ),
    ).toEqual([]);
  });
});
