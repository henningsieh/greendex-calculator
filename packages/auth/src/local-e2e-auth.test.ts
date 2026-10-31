import { describe, expect, it } from "vitest";
import { z } from "zod";

import { localE2EAuthEnabled, localE2EAuthEnvironment } from "./local-e2e-auth";

const schema = z.object(localE2EAuthEnvironment);

describe("local test-server auth environment", () => {
  it.each([
    [{}, false],
    [{ GREENDEX_LOCAL_TEST_SERVER: "0" }, false],
    [{ GREENDEX_LOCAL_TEST_SERVER: "1" }, true],
    [{ GREENDEX_LOCAL_TEST_SERVER: "1", LOCAL_E2E_AUTH: "0" }, false],
    [{ GREENDEX_LOCAL_TEST_SERVER: "0", LOCAL_E2E_AUTH: "1" }, true],
    [{ LOCAL_E2E_AUTH: "1" }, true],
  ])("resolves %j to %s", (input, expected) => {
    expect(localE2EAuthEnabled(schema.parse(input))).toBe(expected);
  });

  it.each(["LOCAL_E2E_AUTH", "GREENDEX_LOCAL_TEST_SERVER"])(
    "rejects invalid %s values",
    (key) => {
      for (const value of ["", "true", "2", " 1 "]) {
        expect(schema.safeParse({ [key]: value }).success).toBe(false);
      }
    },
  );
});
