// @vitest-environment node
import { strict as assert } from "node:assert";
import { randomBytes, randomUUID } from "node:crypto";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { describe, it } from "vitest";
import { vi } from "vitest";

import { env } from "@/env";

vi.mock("server-only", () => ({}));
import { getProofFile, putProofFile } from "@/lib/proof-storage";

describe("Proof storage dev Garage round trip", () => {
  it("returns the exact bytes and cleans up its unique test object", async () => {
    const key = `smoke-tests/claim-ui-${randomUUID()}`;
    const bytes = randomBytes(32);
    const client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
    try {
      await putProofFile(key, bytes, "application/pdf");
      assert.deepEqual(Buffer.from(await getProofFile(key)), bytes);
    } finally {
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
        );
      } finally {
        client.destroy();
      }
    }
  });
});
