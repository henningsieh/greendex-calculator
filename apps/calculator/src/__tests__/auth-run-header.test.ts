// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  TEST_RUN_ID: undefined as string | undefined,
}));
vi.mock("@/env", () => ({ env: state }));
vi.mock("@/lib/better-auth", () => ({ auth: {} }));
vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: () => ({
    GET: async () => new Response("null"),
    POST: async () => new Response("{}"),
  }),
}));
import { GET, POST } from "@/app/api/auth/[...all]/route";

beforeEach(() => {
  state.TEST_RUN_ID = undefined;
});
it("leaves normal auth responses unchanged", async () => {
  expect(
    (await GET(new Request("http://localhost/api/auth/get-session"))).headers.has(
      "X-Greendex-Test-Run",
    ),
  ).toBe(false);
});
it("marks both managed auth methods with exact run ownership", async () => {
  state.TEST_RUN_ID = "a".repeat(32);
  for (const method of [GET, POST])
    expect(
      (
        await method(new Request("http://localhost/api/auth/get-session"))
      ).headers.get("X-Greendex-Test-Run"),
    ).toBe(state.TEST_RUN_ID);
});
