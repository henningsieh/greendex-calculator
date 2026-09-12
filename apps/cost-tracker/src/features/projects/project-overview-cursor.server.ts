import "server-only";
import { createHash } from "node:crypto";

import { z } from "zod";

import { PROJECT_SORT_MODES } from "@/features/projects/collection-state";

const CursorSchema = z.object({
  version: z.literal(2),
  direction: z.enum(["next", "previous"]),
  fingerprint: z.string().length(64),
  sort: z.enum(PROJECT_SORT_MODES),
  id: z.string().min(1).max(128),
  date: z.iso.datetime(),
  open: z.boolean().optional(),
});

export type ProjectOverviewCursor = z.infer<typeof CursorSchema>;

export function getProjectOverviewFingerprint(input: {
  scope: "hosted" | "partner";
  search?: string;
  window: "all" | "open" | "closed";
  dateFrom?: Date;
  dateTo?: Date;
  sort: (typeof PROJECT_SORT_MODES)[number];
  pageSize: 25 | 50 | 100;
  partnerOrganizationIds?: string[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        scope: input.scope,
        search: input.search,
        window: input.window,
        dateFrom: input.dateFrom?.toISOString(),
        dateTo: input.dateTo?.toISOString(),
        sort: input.sort,
        pageSize: input.pageSize,
        partnerOrganizationIds: [...(input.partnerOrganizationIds ?? [])].sort(),
      }),
    )
    .digest("hex");
}

export function encodeProjectOverviewCursor(
  cursor: ProjectOverviewCursor,
): string {
  return Buffer.from(JSON.stringify(CursorSchema.parse(cursor))).toString(
    "base64url",
  );
}

export function decodeProjectOverviewCursor(
  value: string,
  fingerprint: string,
): ProjectOverviewCursor | undefined {
  try {
    const cursor = CursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );

    return cursor.fingerprint === fingerprint ? cursor : undefined;
  } catch {
    return undefined;
  }
}
