// @vitest-environment node
/* eslint-disable import/no-relative-parent-imports -- Tests the owning script's verification boundary. */
import { describe, expect, it, vi } from "vitest";

import {
  assertDevelopmentGarageTarget,
  verifyInvalidGarageCredentials,
} from "../../scripts/garage-verification";

describe("Garage verification", () => {
  it("allows only the development bucket over HTTP(S)", () => {
    expect(() =>
      assertDevelopmentGarageTarget(
        "greendex-cost-tracker-development",
        "https://garage.sslip.io",
      ),
    ).not.toThrow();
    for (const [bucket, endpoint] of [
      ["greendex-cost-tracker-staging", "https://garage.sslip.io"],
      ["unknown", "https://garage.sslip.io"],
      ["greendex-cost-tracker-development", "ftp://garage.sslip.io"],
      ["greendex-cost-tracker-development", "https://staging.example.org"],
      ["greendex-cost-tracker-development", "https://production.example.org"],
    ])
      expect(() => assertDevelopmentGarageTarget(bucket!, endpoint!)).toThrow();
  });
  it.each(["InvalidAccessKeyId", "SignatureDoesNotMatch", "AccessDenied"])(
    "accepts explicit %s credential rejection",
    async (name) => {
      const valid = { send: vi.fn() };
      await expect(
        verifyInvalidGarageCredentials(
          {
            send: vi
              .fn()
              .mockRejectedValue(Object.assign(new Error("rejected"), { name })),
          },
          valid,
          "bucket",
          "key",
          Buffer.from("probe"),
        ),
      ).resolves.toBeUndefined();
      expect(valid.send).not.toHaveBeenCalled();
    },
  );
  it.each(["TimeoutError", "ServiceUnavailable", "Error"])(
    "fails on %s instead of false-passing",
    async (name) => {
      await expect(
        verifyInvalidGarageCredentials(
          {
            send: vi
              .fn()
              .mockRejectedValue(Object.assign(new Error("failure"), { name })),
          },
          { send: vi.fn() },
          "bucket",
          "key",
          Buffer.from("probe"),
        ),
      ).rejects.toThrow();
    },
  );
  it("fails after successful invalid PUT and deletes only the probe", async () => {
    const valid = { send: vi.fn().mockResolvedValue({}) };
    await expect(
      verifyInvalidGarageCredentials(
        { send: vi.fn().mockResolvedValue({}) },
        valid,
        "bucket",
        "run-key",
        Buffer.from("probe"),
      ),
    ).rejects.toThrow(/accepted/);
    expect(valid.send.mock.calls[0]![0].input).toEqual({
      Bucket: "bucket",
      Key: "run-key",
    });
  });
  it("propagates cleanup failure after successful invalid PUT", async () => {
    const failure = new Error("cleanup failed");
    await expect(
      verifyInvalidGarageCredentials(
        { send: vi.fn().mockResolvedValue({}) },
        { send: vi.fn().mockRejectedValue(failure) },
        "bucket",
        "key",
        Buffer.from("probe"),
      ),
    ).rejects.toBe(failure);
  });
});
