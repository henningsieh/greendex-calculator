import { describe, expect, it, vi } from "vitest";

vi.mock("@greendex/database", () => ({ db: {} }));

import { trustedOriginsFor } from "./server-auth";

describe("trustedOriginsFor", () => {
  it("keeps loopback origins closed without a www alias", () => {
    expect(trustedOriginsFor("http://localhost:3000")).toEqual([
      "http://localhost:3000",
    ]);
    expect(trustedOriginsFor("http://127.0.0.1:3002")).toEqual([
      "http://127.0.0.1:3002",
    ]);
  });

  it("trusts the deployment origin plus its www alias", () => {
    expect(trustedOriginsFor("https://greendex.apps.sieh.org")).toEqual([
      "https://greendex.apps.sieh.org",
      "https://www.greendex.apps.sieh.org",
    ]);
    expect(trustedOriginsFor("https://pr-42.greendex.apps.sieh.org")).toEqual([
      "https://pr-42.greendex.apps.sieh.org",
      "https://www.pr-42.greendex.apps.sieh.org",
    ]);
  });

  it("falls back to the raw value for an invalid base URL", () => {
    expect(trustedOriginsFor("not a url")).toEqual(["not a url"]);
  });
});
