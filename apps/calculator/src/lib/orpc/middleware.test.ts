// @vitest-environment node
import {
  calculatorOrganizationRoles,
  ORGANIZATION_ROLES,
} from "@greendex/auth/permissions";
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), hasPermission: vi.fn() }));
vi.mock("@/lib/better-auth", () => ({ auth: { api: mocks } }));

import { authorized, requireProjectPermissions } from "./middleware";

const handler = vi.fn(() => "permitted");
const client = createRouterClient(
  {
    archive: authorized
      .use(requireProjectPermissions(["archive"]))
      .handler(handler),
  },
  { context: { headers: new Headers() } },
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    session: { activeOrganizationId: "org-id" },
    user: { id: "user-id" },
  });
});

describe("requireProjectPermissions", () => {
  it.each(Object.values(ORGANIZATION_ROLES))(
    "enforces declared archive permission for %s",
    async (role) => {
      const success = calculatorOrganizationRoles[role].authorize({
        project: ["archive"],
      }).success;
      mocks.hasPermission.mockResolvedValue({ success, error: null });
      if (
        role === ORGANIZATION_ROLES.OrganizationOwner ||
        role === ORGANIZATION_ROLES.OrganizationAdmin
      ) {
        await expect(client.archive()).resolves.toBe("permitted");
      } else {
        await expect(client.archive()).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
        expect(handler).not.toHaveBeenCalled();
      }
    },
  );

  it("keeps missing sessions unauthorized", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(client.archive()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.hasPermission).not.toHaveBeenCalled();
  });

  it("denies a missing active Organization before permission lookup", async () => {
    mocks.getSession.mockResolvedValue({ session: {}, user: { id: "user-id" } });
    await expect(client.archive()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.hasPermission).not.toHaveBeenCalled();
  });
});
