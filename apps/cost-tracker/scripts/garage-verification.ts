import { strict as assert } from "node:assert";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

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
): Promise<void> {
  try {
    await invalidClient.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: payload }),
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
      await validClient.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    }
    assert(
      rejected,
      "Garage negative probe did not return a credential rejection",
    );
    return;
  }
  // Keep cleanup outside the rejection catch: a failed deletion must never pass.
  await validClient.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  throw new Error(
    "Garage accepted a request with invalid credentials; expected rejection.",
  );
}

export async function verifyGarageObject(
  client: Pick<S3Client, "send">,
  bucket: string,
  key: string,
  payload: Buffer,
): Promise<void> {
  let checkError: unknown;
  try {
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: payload }),
    );

    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
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

  // A rejected PUT may already be committed (response loss). DELETE is
  // idempotent and must run even then, against only this uniquely owned key.
  let cleanupError: unknown;
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.log("Garage smoke-test object deleted.");
  } catch (error) {
    cleanupError = error;
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
}
