import { strict as assert } from "node:assert";
import { randomBytes, randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { CostTrackerServerEnvironmentSchema } from "@greendex/cost-tracker/environment-schemas";
import type { z } from "zod";

export class GarageCleanupError extends Error {
  constructor(
    readonly key: string,
    cause: unknown,
  ) {
    super(
      `Garage smoke-test cleanup failed for run-owned key; remove ${key} manually after confirming it belongs to this run.`,
      { cause },
    );
  }
}

const REQUEST_TIMEOUT_MS = 5_000;
export const developmentGarageEnvironmentSchema =
  CostTrackerServerEnvironmentSchema.pick({
    S3_ENDPOINT: true,
    S3_REGION: true,
    S3_BUCKET: true,
    S3_ACCESS_KEY_ID: true,
    S3_SECRET_ACCESS_KEY: true,
    S3_FORCE_PATH_STYLE: true,
  });

export function validatedDevelopmentGarageEnvironment(
  local: Record<string, string>,
  injected: Record<string, string | undefined>,
): Record<string, string> {
  const config = developmentGarageEnvironmentSchema.parse({
    ...injected,
    ...local,
  });
  assertDevelopmentGarageTarget(config.S3_BUCKET, config.S3_ENDPOINT);
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, String(value)]),
  );
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  return AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  ]);
}

export async function verifyDevelopmentGarage(
  config: z.output<typeof developmentGarageEnvironmentSchema>,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  assertDevelopmentGarageTarget(config.S3_BUCKET, config.S3_ENDPOINT);
  const runId = randomUUID();
  const options = {
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    maxAttempts: 1,
  };
  const client = new S3Client({
    ...options,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
  });
  const invalidClient = new S3Client({
    ...options,
    credentials: {
      accessKeyId: `INVALID-${runId}`,
      secretAccessKey: "invalid-secret-key",
    },
  });
  const payload = randomBytes(64);
  try {
    await verifyGarageObject(
      client,
      config.S3_BUCKET,
      `smoke-tests/${runId}/object`,
      payload,
      signal,
    );
    signal?.throwIfAborted();
    await verifyInvalidGarageCredentials(
      invalidClient,
      client,
      config.S3_BUCKET,
      `smoke-tests/${runId}/invalid-credential-probe`,
      payload,
      signal,
    );
    console.log("Garage invalid-credential check passed (rejected as expected).");
  } finally {
    invalidClient.destroy();
    client.destroy();
  }
}

export function assertDevelopmentGarageTarget(
  bucket: string,
  endpoint: string,
): void {
  // Bucket identity is the environment boundary; managed endpoint hostnames
  // legitimately vary (including sslip.io), so no static endpoint allowlist.
  const url = new URL(endpoint);
  assert.equal(
    bucket,
    "greendex-cost-tracker-development",
    "Refusing non-development Garage bucket",
  );
  assert(
    ["http:", "https:"].includes(url.protocol),
    "Refusing non-HTTP Garage endpoint",
  );
  assert(
    !/staging|production/i.test(url.hostname),
    "Refusing non-development Garage endpoint",
  );
}

export async function verifyInvalidGarageCredentials(
  invalidClient: Pick<S3Client, "send">,
  validClient: Pick<S3Client, "send">,
  bucket: string,
  key: string,
  payload: Buffer,
  signal?: AbortSignal,
): Promise<void> {
  try {
    await invalidClient.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: payload }),
      { abortSignal: requestSignal(signal) },
    );
  } catch (error) {
    // Transport, service and arbitrary failures are not credential rejection.
    const rejected =
      error instanceof Error &&
      ["InvalidAccessKeyId", "SignatureDoesNotMatch", "AccessDenied"].includes(
        error.name,
      );
    if (!rejected) {
      // An ambiguous response may have committed, even for the negative probe.
      await cleanupGarageObject(validClient, bucket, key);
    }
    assert(
      rejected,
      "Garage negative probe did not return a credential rejection",
    );
    return;
  }
  // Keep cleanup outside the rejection catch: a failed deletion must never pass.
  await cleanupGarageObject(validClient, bucket, key);
  throw new Error(
    "Garage accepted a request with invalid credentials; expected rejection.",
  );
}

export async function verifyGarageObject(
  client: Pick<S3Client, "send">,
  bucket: string,
  key: string,
  payload: Buffer,
  signal?: AbortSignal,
): Promise<void> {
  let checkError: unknown;
  try {
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: payload }),
      { abortSignal: requestSignal(signal) },
    );

    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { abortSignal: requestSignal(signal) },
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

  await cleanupGarageObject(client, bucket, key);
  if (checkError !== undefined) {
    throw checkError;
  }
}

async function cleanupGarageObject(
  client: Pick<S3Client, "send">,
  bucket: string,
  key: string,
): Promise<void> {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
      abortSignal: requestSignal(),
    });
    console.log("Garage smoke-test object deleted.");
  } catch (cause) {
    throw new GarageCleanupError(key, cause);
  }
}
