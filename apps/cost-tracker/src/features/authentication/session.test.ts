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

import {
  invitationReturnTo,
  safeSignInReturnTo,
  setupLinkReturnTo,
  requireSession,
} from "@/lib/session";

describe("Cost Tracker protected session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects an unauthenticated request to login", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("preserves a safe Organization Invitation destination on sign-in", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireSession("/accept-invitation/invite-1")).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/login?next=%2Faccept-invitation%2Finvite-1",
    );
    expect(invitationReturnTo("https://elsewhere.example/")).toBeUndefined();
    expect(invitationReturnTo("//elsewhere.example")).toBeUndefined();
    expect(invitationReturnTo(["/accept-invitation/one"])).toBeUndefined();
  });

  it("preserves a Partner setup-link destination across sign-in", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(
      requireSession("/setup-links/link-1?secret=private-secret"),
    ).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/login?next=%2Fsetup-links%2Flink-1%3Fsecret%3Dprivate-secret",
    );
    expect(setupLinkReturnTo("/setup-links/link-1?secret=private-secret")).toBe(
      "/setup-links/link-1?secret=private-secret",
    );
    expect(setupLinkReturnTo("/setup-links/link-1")).toBe("/setup-links/link-1");
    expect(safeSignInReturnTo("/accept-invitation/invite-1")).toBe(
      "/accept-invitation/invite-1",
    );
    expect(safeSignInReturnTo("/setup-links/link-1?secret=private-secret")).toBe(
      "/setup-links/link-1?secret=private-secret",
    );
    expect(setupLinkReturnTo("https://elsewhere.example/")).toBeUndefined();
    expect(setupLinkReturnTo("//elsewhere.example")).toBeUndefined();
    expect(setupLinkReturnTo(["/setup-links/one"])).toBeUndefined();
    expect(setupLinkReturnTo("/setup-links/one?secret=a&b")).toBeUndefined();
    expect(safeSignInReturnTo("https://elsewhere.example/")).toBeUndefined();
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
