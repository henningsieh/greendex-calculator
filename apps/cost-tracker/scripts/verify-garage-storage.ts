import { strict as assert } from "node:assert";
import { randomBytes, randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "@/env";

import {
  assertDevelopmentGarageTarget,
  verifyInvalidGarageCredentials,
} from "./garage-verification";

assertDevelopmentGarageTarget(env.S3_BUCKET, env.S3_ENDPOINT);

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

// Unique run-owned keys avoid collisions in the configured app bucket; these
// keys are not application data. Only keys under this run prefix may be
// removed by this script - never a bucket or a shared prefix.
const runId = randomUUID();
const key = `smoke-tests/${runId}/object`;
const invalidCredentialKey = `smoke-tests/${runId}/invalid-credential-probe`;
const payload = randomBytes(64);

try {
  let uploaded = false;
  let checkError: unknown;
  try {
    await client.send(
      new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: payload }),
    );
    uploaded = true;

    const response = await client.send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    );
    assert(response.Body, "Garage returned no object body");
    assert.deepEqual(
      Buffer.from(await response.Body.transformToByteArray()),
      payload,
    );
    console.log("Garage PUT/GET byte-for-byte check passed.");
  } catch (error) {
    checkError = error;
  }

  // Cleanup runs on success and failure and targets only the run-owned key.
  let cleanupError: unknown;
  if (uploaded) {
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
      );
      console.log("Garage smoke-test object deleted.");
    } catch (error) {
      cleanupError = error;
    }
  }
  if (cleanupError !== undefined) {
    throw new Error(
      `Garage smoke-test cleanup failed for run-owned key; remove ${key} manually after confirming it belongs to this run.`,
      { cause: cleanupError },
    );
  }
  if (checkError !== undefined) {
    throw checkError;
  }

  // Controlled invalid-credential check: an in-memory client with bogus
  // credentials must be rejected. App and staging credentials are never
  // touched; only this process-local client is invalid, so the valid check
  // configuration is intact once this block finishes.
  const invalidClient = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: `INVALID-${runId}`,
      secretAccessKey: "invalid-secret-key",
    },
  });
  try {
    await verifyInvalidGarageCredentials(
      invalidClient,
      client,
      env.S3_BUCKET,
      invalidCredentialKey,
      payload,
    );
    console.log("Garage invalid-credential check passed (rejected as expected).");
  } finally {
    invalidClient.destroy();
  }
} finally {
  client.destroy();
}
