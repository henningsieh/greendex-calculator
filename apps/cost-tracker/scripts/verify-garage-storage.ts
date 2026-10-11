import { strict as assert } from "node:assert";
import { randomBytes, randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "@/env";

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

// Unique keys avoid collisions in the existing bucket; this key is not application data.
const key = `smoke-tests/${randomUUID()}`;
const payload = randomBytes(64);
let uploaded = false;

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
} finally {
  try {
    if (uploaded) {
      await client.send(
        new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
      );
      console.log("Garage smoke-test object deleted.");
    }
  } finally {
    client.destroy();
  }
}
