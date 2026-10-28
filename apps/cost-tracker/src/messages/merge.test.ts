import { describe, expect, it } from "vitest";

import { mergeMessages } from "./merge";

describe("mergeMessages", () => {
  it("merges top-level namespaces", () => {
    expect(
      mergeMessages([{ common: { confirm: "OK" } }, { claims: { title: "A" } }]),
    ).toEqual({
      common: { confirm: "OK" },
      claims: { title: "A" },
    });
  });

  it("rejects duplicate top-level namespaces", () => {
    expect(() =>
      mergeMessages([
        { common: { confirm: "OK" } },
        { common: { cancel: "No" } },
      ]),
    ).toThrow("Duplicate message namespace: common");
  });
});
