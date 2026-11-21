import "server-only";
import { createHash } from "node:crypto";

import { z } from "zod";

import type { ClaimQueueInput } from "@/features/claims/queue-schemas";

const ClaimQueueCursorSchema = z.object({
  version: z.literal(1),
  direction: z.enum(["next", "previous"]),
  fingerprint: z.string().length(64),
  id: z.string().min(1).max(128),
  value: z.string().max(512),
});

export type ClaimQueueCursor = z.infer<typeof ClaimQueueCursorSchema>;

export function getClaimQueueFingerprint(input: ClaimQueueInput) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        search: input.search,
        partnerOrganizationId: input.partnerOrganizationId,
        sort: input.sort,
        pageSize: input.pageSize,
      }),
    )
    .digest("hex");
}

export function encodeClaimQueueCursor(cursor: ClaimQueueCursor): string {
  return Buffer.from(
    JSON.stringify(ClaimQueueCursorSchema.parse(cursor)),
  ).toString("base64url");
}

export function decodeClaimQueueCursor(value: string, fingerprint: string) {
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) return null;
    const payload: unknown = JSON.parse(bytes.toString("utf8"));
    const cursor = ClaimQueueCursorSchema.safeParse(payload);
    if (!cursor.success || cursor.data.fingerprint !== fingerprint) return null;
    return cursor.data;
  } catch {
    return null;
  }
}
