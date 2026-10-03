// @vitest-environment node
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  scope: vi.fn(),
  returning: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/features/projects/procedures/coordination", async () => {
  const { z } = await import("zod");
  return {
    coordinationId: z.string().min(1),
    requirePartnerCoordination: mocks.scope,
  };
});
vi.mock("@greendex/database", () => ({
  db: {
    update: () => ({
      set: () => ({ where: () => ({ returning: mocks.returning }) }),
    }),
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }),
  },
}));
import { duplicateReviews } from "@/features/projects/procedures/duplicate-reviews";

const client = createRouterClient(duplicateReviews, {
  context: async () => ({ headers: new Headers() }),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    user: { id: "actor" },
    session: { activeOrganizationId: "partner" },
  });
  mocks.scope.mockResolvedValue({
    hostId: "host",
    partnerId: "partner",
    projectId: "project",
  });
  mocks.returning.mockResolvedValue([]);
});
describe("duplicate Review Task guarded refusal", () => {
  it.each([
    [[], "NOT_FOUND", 404, "REVIEW_TASK_NOT_FOUND"],
    [[{ status: "assigned" }], "BAD_REQUEST", 400, "REVIEW_TASK_NOT_OPEN"],
    [[{ status: "open" }], "INTERNAL_SERVER_ERROR", 500, "INTERNAL_FAILURE"],
  ] as const)(
    "assign distinguishes scoped absence, state and unexplained refusal (%s)",
    async (rows, code, status, reason) => {
      mocks.limit.mockResolvedValue(rows);
      await expect(
        client.assign({ partnershipId: "own", id: "task" }),
      ).rejects.toMatchObject({ code, status, data: { reason } });
      expect(mocks.returning).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    [[], "NOT_FOUND", 404, "REVIEW_TASK_NOT_FOUND"],
    [[{ status: "open" }], "BAD_REQUEST", 400, "REVIEW_TASK_NOT_ASSIGNED"],
    [
      [{ status: "assigned", assignedToUserId: "other" }],
      "FORBIDDEN",
      403,
      "REVIEW_TASK_ASSIGNEE_REQUIRED",
    ],
    [
      [
        {
          status: "assigned",
          assignedToUserId: "actor",
          existingParticipationId: "other",
        },
      ],
      "BAD_REQUEST",
      400,
      "REVIEW_TASK_SURVIVOR_REQUIRED",
    ],
    [
      [
        {
          status: "assigned",
          assignedToUserId: "actor",
          existingParticipationId: "survivor",
        },
      ],
      "INTERNAL_SERVER_ERROR",
      500,
      "INTERNAL_FAILURE",
    ],
  ] as const)(
    "resolve distinguishes absence, state, assignment, selection and invariant (%s)",
    async (rows, code, status, reason) => {
      mocks.limit.mockResolvedValue(rows);
      await expect(
        client.resolve({
          partnershipId: "own",
          id: "task",
          decision: "dismiss",
          survivorParticipationId: "survivor",
        }),
      ).rejects.toMatchObject({ code, status, data: { reason } });
      expect(mocks.returning).toHaveBeenCalledTimes(1);
    },
  );
});
