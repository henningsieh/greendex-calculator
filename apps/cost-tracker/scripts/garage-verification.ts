import { strict as assert } from "node:assert";

import {
  DeleteObjectCommand,
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
    assert(
      error instanceof Error &&
        ["InvalidAccessKeyId", "SignatureDoesNotMatch", "AccessDenied"].includes(
          error.name,
        ),
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
