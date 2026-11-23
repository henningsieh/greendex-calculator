import "server-only";
import { createHash } from "node:crypto";

import { z } from "zod";

import { PROJECT_CURSOR_VERSION } from "@/features/projects/list-cursor-version";
import {
  normalizeProjectStatuses,
  ProjectSortOrderSchema,
  type ProjectStatus,
} from "@/features/projects/validation-schemas";

const CursorVersionSchema = z.object({ version: z.number().int() }).loose();

const CursorSchema = z.object({
  version: z.literal(PROJECT_CURSOR_VERSION),
  direction: z.enum(["next", "previous"]),
  fingerprint: z.string().length(64),
  id: z.string().min(1).max(128),
  values: z
    .array(
      z.discriminatedUnion("field", [
        z.object({
          field: z.literal("status"),
          value: z.number().int().min(0).max(2),
        }),
        // Names are unbounded in the shared Project model. Resolve the name
        // from the cursor's ID inside the authorized scope, not in the token.
        z.object({ field: z.literal("name") }),
        z.object({ field: z.literal("startDate"), value: z.iso.datetime() }),
        z.object({ field: z.literal("endDate"), value: z.iso.datetime() }),
      ]),
    )
    .min(1)
    .max(4),
});

export type ProjectListCursor = z.infer<typeof CursorSchema>;

export function getProjectListFingerprint(input: {
  scope: "hosted" | "partner";
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: readonly ProjectStatus[];
  sort: z.infer<typeof ProjectSortOrderSchema>;
  pageSize: 25 | 50 | 100;
  partnerOrganizationIds?: string[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        scope: input.scope,
        search: input.search,
        dateFrom: input.dateFrom?.toISOString(),
        dateTo: input.dateTo?.toISOString(),
        status: normalizeProjectStatuses(input.status ?? []),
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
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) return { status: "invalid" };
    const payload: unknown = JSON.parse(bytes.toString("utf8"));
    const version = CursorVersionSchema.safeParse(payload);

    if (!version.success) return { status: "invalid" };
    if (version.data.version !== PROJECT_CURSOR_VERSION)
      return { status: "unsupported-version" };

    const cursor = CursorSchema.safeParse(payload);
    if (!cursor.success || cursor.data.fingerprint !== fingerprint) {
      return { status: "invalid" };
    }

    return { status: "valid", cursor: cursor.data };
  } catch {
    return { status: "invalid" };
  }
}
