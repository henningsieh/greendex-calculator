import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthLayout from "@/app/[locale]/(auth)/layout";
import OrgSetupLayout from "@/app/[locale]/(org-setup)/layout";
import { CREATE_ORG_PATH, DASHBOARD_PATH } from "@/app/routes";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOrganizations: vi.fn(),
  headers: vi.fn(),
  connection: vi.fn(),
  checkAuthAndOrgs: vi.fn(),
  handleUnauthenticatedRedirect: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("@/lib/better-auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
      listOrganizations: mocks.listOrganizations,
    },
  },
}));
vi.mock("@/features/authentication/utils", () => ({
  checkAuthAndOrgs: mocks.checkAuthAndOrgs,
  handleUnauthenticatedRedirect: mocks.handleUnauthenticatedRedirect,
}));
vi.mock("@/lib/i18n/routing", () => ({ redirect: mocks.redirect }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.headers.mockResolvedValue(new Headers({ "x-test-request": "current" }));
  mocks.connection.mockResolvedValue(undefined);
  mocks.redirect.mockImplementation(() => {
    throw new Error("redirect");
  });
});

const props = () => ({
  params: Promise.resolve({ locale: "de" }),
  children: <p>protected content</p>,
});

describe("auth layout route locale", () => {
  it.each([null, { user: null }])(
    "renders signed-out content for session %j",
    async (session) => {
      mocks.getSession.mockResolvedValue(session);
      expect(renderToStaticMarkup(await AuthLayout(props()))).toBe(
        "<p>protected content</p>",
      );
      expect(mocks.listOrganizations).not.toHaveBeenCalled();
      expect(mocks.redirect).not.toHaveBeenCalled();
      expect(mocks.getSession).toHaveBeenCalledWith({
        headers: await mocks.headers(),
      });
    },
  );

  it.each([
    [[{ id: "org-1" }], DASHBOARD_PATH],
    [[], CREATE_ORG_PATH],
    [null, CREATE_ORG_PATH],
    [undefined, CREATE_ORG_PATH],
    [{}, CREATE_ORG_PATH],
  ])(
    "redirects memberships %j with the locale from params",
    async (organizations, href) => {
      mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
      mocks.listOrganizations.mockResolvedValue(organizations);
      await expect(AuthLayout(props())).rejects.toThrow("redirect");
      expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith({
        locale: "de",
        href,
      });
      expect(mocks.listOrganizations).toHaveBeenCalledWith({
        headers: await mocks.headers(),
      });
    },
  );

  it("waits for session resolution before rendering auth content", async () => {
    const session = Promise.withResolvers<null>();
    mocks.getSession.mockReturnValue(session.promise);
    const completed = vi.fn();
    const layout = AuthLayout(props()).then(completed);
    // Synchronize on the actual session read before testing that the gate holds.
    await vi.waitFor(() => expect(mocks.getSession).toHaveBeenCalled(), {
      interval: 1,
      timeout: 100,
    });
    expect(completed).not.toHaveBeenCalled();
    session.resolve(null);
    await layout;
    expect(completed).toHaveBeenCalledOnce();
  });

  it("propagates session failures instead of displaying the auth form", async () => {
    mocks.getSession.mockRejectedValue(new Error("session unavailable"));
    await expect(AuthLayout(props())).rejects.toThrow("session unavailable");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("organization setup layout route locale", () => {
  it("preserves the remembered destination for signed-out users", async () => {
    mocks.checkAuthAndOrgs.mockResolvedValue({
      session: null,
      hasOrgs: false,
      rememberedPath: "/create-org?invite=abc",
    });
    mocks.handleUnauthenticatedRedirect.mockReturnValue(
      "/login?nextPageUrl=%2Fcreate-org%3Finvite%3Dabc",
    );
    await expect(OrgSetupLayout(props())).rejects.toThrow("redirect");
    expect(mocks.handleUnauthenticatedRedirect).toHaveBeenCalledExactlyOnceWith(
      "/create-org?invite=abc",
      CREATE_ORG_PATH,
    );
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith({
      href: "/login?nextPageUrl=%2Fcreate-org%3Finvite%3Dabc",
      locale: "de",
    });
  });

  it("redirects existing members before showing setup", async () => {
    mocks.checkAuthAndOrgs.mockResolvedValue({
      session: { user: { id: "user-1" } },
      hasOrgs: true,
    });
    await expect(OrgSetupLayout(props())).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith({
      href: DASHBOARD_PATH,
      locale: "de",
    });
    expect(mocks.handleUnauthenticatedRedirect).not.toHaveBeenCalled();
  });

  it("renders setup for signed-in users without organizations", async () => {
    mocks.checkAuthAndOrgs.mockResolvedValue({
      session: { user: { id: "user-1" } },
      hasOrgs: false,
    });
    expect(renderToStaticMarkup(await OrgSetupLayout(props()))).toBe(
      "<p>protected content</p>",
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
