// @vitest-environment node
import { createRouterClient } from "@orpc/server";
import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getFullOrganization: vi.fn(),
  updateOrganization: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: mocks } }));

import {
  getSettings,
  updateCountry,
} from "@/features/organizations/procedures/settings";

const headers = new Headers({ cookie: "request-cookie" });
const client = createRouterClient(
  { getSettings, updateCountry },
  { context: { headers } },
);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    session: { activeOrganizationId: "active-org" },
    user: { id: "owner-id" },
  });
  mocks.getFullOrganization.mockResolvedValue({
    id: "active-org",
    name: "Organization",
    country: "DE",
  });
  mocks.updateOrganization.mockResolvedValue({ country: "FR" });
});

describe("active Organization country settings", () => {
  it("reads only the active Organization and updates it through supported Better Auth APIs", async () => {
    expect(await client.getSettings()).toEqual({
      id: "active-org",
      name: "Organization",
      country: "DE",
    });
    expect(mocks.getFullOrganization).toHaveBeenCalledWith({
      headers,
      query: { organizationId: "active-org" },
    });
    expect(await client.updateCountry({ country: "FR" })).toEqual({
      success: true,
    });
    expect(mocks.updateOrganization).toHaveBeenCalledWith({
      headers,
      body: { organizationId: "active-org", data: { country: "FR" } },
    });
  });

  it("refuses invalid/missing country before any update", async () => {
    for (const input of [{}, { country: "US" }, { country: null }]) {
      await expect(
        client.updateCountry(input as { country: "FR" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  it("refuses a missing tenant and preserves Better Auth authorization refusal", async () => {
    mocks.getSession.mockResolvedValueOnce({
      session: {},
      user: { id: "owner-id" },
    });
    await expect(client.updateCountry({ country: "FR" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    });
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
    mocks.updateOrganization.mockRejectedValueOnce(
      new APIError("FORBIDDEN", { message: "Not permitted" }),
    );
    await expect(client.updateCountry({ country: "FR" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
