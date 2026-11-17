// @vitest-environment node

import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cookies: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));

import { readProjectVisibility, readSidebarPreference } from "./server";

beforeEach(() => vi.resetAllMocks());

it("restores valid request cookies for the matching account", async () => {
  mocks.cookies.mockResolvedValue({
    get: (name: string) =>
      name === "sidebar_state"
        ? { value: "false" }
        : { value: '[1,["location"]]' },
  });
  expect(await readSidebarPreference()).toBe(false);
  expect((await readProjectVisibility("user-a")).visibility).toEqual({
    location: false,
  });
  expect((await readProjectVisibility("user-a")).accountKey).not.toBe(
    (await readProjectVisibility("user-b")).accountKey,
  );
});

it("uses defaults when request cookies are unavailable", async () => {
  mocks.cookies.mockRejectedValue(new Error("unavailable"));
  expect(await readSidebarPreference()).toBe(true);
  expect((await readProjectVisibility("user-a")).visibility).toEqual({});
});
