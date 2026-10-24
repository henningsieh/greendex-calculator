// @vitest-environment node
/* eslint-disable import/no-relative-parent-imports -- Tests the owning script's verification boundary. */
import { createServer } from "node:http";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import {
  assertDevelopmentGarageTarget,
  verifyDevelopmentGarage,
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
    ).rejects.toMatchObject({
      cause: failure,
      message: expect.stringContaining("cleanup failed"),
    });
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
        await expect(result).rejects.toMatchObject({
          key: "owned-run-key",
          cause: deletionFailure,
          message: expect.stringContaining("cleanup failed"),
        });
        expect(objects.has("owned-run-key")).toBe(true);
      } else {
        await expect(result).rejects.toBe(lostResponse);
        expect(objects.has("owned-run-key")).toBe(false);
      }
      expect(objects.get("developer-object")).toEqual(Buffer.from("preserved"));
    },
  );
});

describe("Garage interruption", () => {
  it.each([
    { probe: "object", deleteFails: false },
    { probe: "object", deleteFails: true },
    { probe: "invalid-credential-probe", deleteFails: false },
    { probe: "invalid-credential-probe", deleteFails: true },
  ])(
    "cancellation cleans only owned keys and rejects incomplete cleanup ($probe, $deleteFails)",
    async ({ probe, deleteFails }) => {
      const objects = new Set(["developer-object"]);
      const put = Promise.withResolvers<string>();
      let payload = Buffer.alloc(0);
      const deleted: string[] = [];
      const server = createServer((request, response) => {
        const key = new URL(request.url!, "http://localhost").pathname
          .split("/")
          .slice(2)
          .join("/");
        if (request.method === "PUT") {
          objects.add(key);
          const chunks: Buffer[] = [];
          request.on("data", (chunk: Buffer) => chunks.push(chunk));
          request.on("end", () => {
            payload = Buffer.concat(chunks);
            if (key.endsWith(`/${probe}`)) put.resolve(key);
            else response.end();
          });
        } else if (request.method === "DELETE") {
          deleted.push(key);
          const fail = deleteFails && key.endsWith(`/${probe}`);
          if (!fail) objects.delete(key);
          response.writeHead(fail ? 503 : 204);
          response.end();
        } else if (request.method === "GET") {
          response.end(payload);
        } else {
          response.writeHead(400);
          response.end();
        }
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Expected TCP listener");
      const controller = new AbortController();
      const pending = verifyDevelopmentGarage(
        {
          S3_BUCKET: "greendex-cost-tracker-development",
          S3_ENDPOINT: `http://127.0.0.1:${address.port}`,
          S3_REGION: "garage",
          S3_FORCE_PATH_STYLE: true,
          S3_ACCESS_KEY_ID: "unused",
          S3_SECRET_ACCESS_KEY: "unused",
        },
        controller.signal,
      );
      const rejected = expect(pending).rejects.toThrow();
      const timeout = setTimeout(() => {
        put.reject(new Error("Verifier did not PUT."));
        controller.abort();
      }, 10_000);
      try {
        const ownedKey = await put.promise;
        controller.abort();
        await rejected;
        const runPrefix = ownedKey.slice(0, ownedKey.lastIndexOf("/") + 1);
        expect(runPrefix).toMatch(/^smoke-tests\/[a-f0-9-]+\/$/);
        expect(deleted).toEqual(
          probe === "object" ? [ownedKey] : [`${runPrefix}object`, ownedKey],
        );
        expect([...objects]).toEqual(
          deleteFails ? ["developer-object", ownedKey] : ["developer-object"],
        );
      } finally {
        clearTimeout(timeout);
        controller.abort();
        await rejected;
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
    15_000,
  );
});
