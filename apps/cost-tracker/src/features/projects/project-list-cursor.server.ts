import "server-only";
import { createHash } from "node:crypto";

import { z } from "zod";

import { PROJECT_SORT_MODES } from "@/features/projects/validation-schemas";

const CursorVersionSchema = z.object({ version: z.number().int() }).loose();

const CursorSchema = z.object({
  version: z.literal(2),
  direction: z.enum(["next", "previous"]),
  fingerprint: z.string().length(64),
  sort: z.enum(PROJECT_SORT_MODES),
  id: z.string().min(1).max(128),
  date: z.iso.datetime(),
  open: z.boolean().optional(),
});

export type ProjectListCursor = z.infer<typeof CursorSchema>;

export function getProjectListFingerprint(input: {
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

export function encodeProjectListCursor(cursor: ProjectListCursor): string {
  return Buffer.from(JSON.stringify(CursorSchema.parse(cursor))).toString(
    "base64url",
  );
}

export function decodeProjectListCursor(
  value: string,
  fingerprint: string,
):
  | { status: "valid"; cursor: ProjectListCursor }
  | { status: "unsupported-version" }
  | { status: "invalid" } {
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    const version = CursorVersionSchema.safeParse(payload);

    if (!version.success) return { status: "invalid" };
    if (version.data.version !== 2) return { status: "unsupported-version" };

    const cursor = CursorSchema.safeParse(payload);
    if (!cursor.success || cursor.data.fingerprint !== fingerprint) {
      return { status: "invalid" };
    }

    return { status: "valid", cursor: cursor.data };
  } catch {
    return { status: "invalid" };
  }
}
