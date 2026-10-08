import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "@/env";

function storage() {
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

export async function putProofFile(
  reference: string,
  bytes: Uint8Array,
  mediaType: string,
) {
  const client = storage();
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: reference,
        Body: bytes,
        ContentType: mediaType,
      }),
    );
  } finally {
    client.destroy();
  }
}

export async function getProofFile(reference: string) {
  const client = storage();
  try {
    const result = await client.send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: reference }),
    );
    if (!result.Body) throw new Error("Proof file has no body.");
    return result.Body.transformToByteArray();
  } finally {
    client.destroy();
  }
}
