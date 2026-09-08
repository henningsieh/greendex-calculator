// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT:/login");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "session=test" }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

import { requireSession } from "@/lib/session";

describe("Cost Tracker protected session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects an unauthenticated request to login", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("returns the authenticated session for the protected shell", async () => {
    const session = {
      session: {
        id: "session-id",
        userId: "user-id",
        activeOrganizationId: "organization-id",
      },
      user: {
        id: "user-id",
        name: "Alex Morgan",
        email: "alex@example.org",
      },
    };
    mocks.getSession.mockResolvedValue(session);

    await expect(requireSession()).resolves.toBe(session);
    expect(mocks.getSession).toHaveBeenCalledWith({
      headers: new Headers({ cookie: "session=test" }),
    });
  });
});
