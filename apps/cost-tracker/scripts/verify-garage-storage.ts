import { randomBytes, randomUUID } from "node:crypto";

import { S3Client } from "@aws-sdk/client-s3";

import { env } from "@/env";

import {
  assertDevelopmentGarageTarget,
  verifyInvalidGarageCredentials,
  verifyGarageObject,
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
  await verifyGarageObject(client, env.S3_BUCKET, key, payload);
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
