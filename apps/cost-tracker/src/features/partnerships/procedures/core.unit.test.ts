// @vitest-environment node
import { createRouterClient } from "@orpc/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  permission: vi.fn(),
  limit: vi.fn(),
  returning: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.session, hasPermission: mocks.permission } },
}));
vi.mock("@greendex/database", () => {
  const query = {
    from: () => query,
    innerJoin: () => query,
    where: () => query,
    for: () => query,
    limit: mocks.limit,
  };
  const tx = {
    select: () => query,
    delete: () => ({ where: () => ({ returning: mocks.returning }) }),
  };
  return {
    db: {
      transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(tx),
    },
  };
});
import { removePartnership } from "@/features/partnerships/procedures/core";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { getErrorStatus } from "@/lib/orpc/error-status";

const client = createRouterClient(
  { removePartnership },
  { context: async () => ({ headers: new Headers() }) },
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({
    user: { id: "actor" },
    session: { activeOrganizationId: "host" },
  });
  mocks.permission.mockResolvedValue({ success: true });
  mocks.limit
    .mockResolvedValueOnce([{ projectId: "project", organizationId: "partner" }])
    .mockResolvedValueOnce([]);
});

it("sanitizes a rare guarded DELETE foreign-key failure instead of treating it as a reference refusal", async () => {
  mocks.returning.mockRejectedValue({
    cause: { code: "23503", detail: "private database detail" },
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const error = await client
      .removePartnership({ id: "partnership" })
      .catch((error: unknown) => error);
    expect(error).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
      data: { reason: "INTERNAL_FAILURE" },
    });
    expect(getErrorStatus("INTERNAL_SERVER_ERROR")).toBe(500);
    expect(getORPCRequestErrorMessage(error)).toEqual({
      sessionExpired: false,
      text: "The request could not be completed. Try again.",
    });
    expect(mocks.returning).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
  }
});
