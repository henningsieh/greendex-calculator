// @vitest-environment node
/* eslint-disable import/no-relative-parent-imports -- Tests the owning script's verification boundary. */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import {
  assertDevelopmentGarageTarget,
  verifyInvalidGarageCredentials,
  verifyGarageObject,
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
  it("cleans an ambiguous invalid-credential PUT with the valid client", async () => {
    const objects = new Set<string>();
    await expect(
      verifyInvalidGarageCredentials(
        {
          send: vi.fn(async () => {
            objects.add("negative-probe");
            throw new Error("response lost");
          }),
        },
        {
          send: vi.fn(async (command: DeleteObjectCommand) => {
            objects.delete(command.input.Key!);
            return {};
          }),
        },
        "bucket",
        "negative-probe",
        Buffer.from("probe"),
      ),
    ).rejects.toThrow("credential rejection");
    expect(objects.size).toBe(0);
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

describe("Garage owned object verification", () => {
  it.each([false, true])(
    "cleans a committed PUT after response loss (DELETE failure: %s)",
    async (deleteFails) => {
      const objects = new Map<string, Buffer>();
      const lostResponse = new Error("PUT response lost");
      const deletionFailure = new Error("DELETE unavailable");
      const client = {
        send: vi.fn(
          async (
            command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand,
          ) => {
            const key = command.input.Key!;
            if (command instanceof PutObjectCommand) {
              objects.set(key, Buffer.from("probe"));
              throw lostResponse;
            }
            if (command instanceof DeleteObjectCommand) {
              if (deleteFails) throw deletionFailure;
              objects.delete(key);
              return {};
            }
            throw new Error("GET should not follow a failed PUT");
          },
        ),
      };
      objects.set("developer-object", Buffer.from("preserved"));
      const result = verifyGarageObject(
        client,
        "bucket",
        "owned-run-key",
        Buffer.from("probe"),
      );
      if (deleteFails) {
        await expect(result).rejects.toThrow(/cleanup failed.*owned-run-key/);
        expect(objects.has("owned-run-key")).toBe(true);
      } else {
        await expect(result).rejects.toBe(lostResponse);
        expect(objects.has("owned-run-key")).toBe(false);
      }
      expect(objects.get("developer-object")).toEqual(Buffer.from("preserved"));
    },
  );
});
