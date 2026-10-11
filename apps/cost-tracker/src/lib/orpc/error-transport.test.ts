// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
afterAll(() => vi.restoreAllMocks());

vi.mock("@/lib/orpc/router", async () => {
  const { os } = await import("@orpc/server");
  const { situationCatalog } = await import("@/lib/orpc/error-contract");
  const { createSituationErrors } = await import("@/lib/orpc/errors");
  const errors = createSituationErrors();
  return {
    router: Object.fromEntries(
      Object.keys(situationCatalog).map((name) => [
        name,
        os.handler(() => {
          if (name === "projectCompletionBlocked")
            throw errors.projectCompletionBlocked([]);
          if (name === "submissionIncomplete")
            throw errors.submissionIncomplete([]);
          throw errors[
            name as Exclude<
              keyof typeof errors,
              "projectCompletionBlocked" | "submissionIncomplete"
            >
          ]();
        }),
      ]),
    ),
  };
});
import { POST } from "@/app/api/rpc/[[...rest]]/route";
import { situationCatalog } from "@/lib/orpc/error-contract";
import { getErrorStatus } from "@/lib/orpc/error-status";

describe("named failure HTTP transport", () => {
  it.each(Object.entries(situationCatalog))(
    "preserves %s status, code and reason",
    async (name, situation) => {
      const response = await POST(
        new Request(`http://localhost/api/rpc/${name}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: '{"json":null}',
        }),
      );
      expect(response.status).toBe(getErrorStatus(situation.code));
      const body = await response.json();
      expect(body.json).not.toHaveProperty("status");
      expect(body).toMatchObject({
        json: { code: situation.code, data: { reason: situation.reason } },
      });
    },
  );
});
