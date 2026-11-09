// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasOrganizationMembership: vi.fn(),
  requireActiveOrganization: vi.fn(),
  canManageOrganization: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@greendex/i18n/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/lib/session", () => ({
  hasOrganizationMembership: mocks.hasOrganizationMembership,
  requireActiveOrganization: mocks.requireActiveOrganization,
}));
vi.mock("@/features/organizations/access", () => ({
  canManageOrganization: mocks.canManageOrganization,
}));
vi.mock("@/features/organizations/components/organization-settings", () => ({
  OrganizationSettings: () => null,
}));
vi.mock("@/features/organizations/components/organization-team", () => ({
  OrganizationTeam: () => null,
}));
vi.mock("@/lib/orpc/orpc", () => ({ orpcQuery: {} }));
vi.mock("@/components/query-data-error-boundary", () => ({
  ProjectDataErrorBoundary: vi.fn(),
}));
vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: vi.fn(),
  HydrateClient: vi.fn(),
  swallowPrefetchError: vi.fn(),
}));

import OrganizationPage from "@/features/organizations/components/organization-page";

describe("Organization page recovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("leaves creation recovery in place without invoking the redirecting helper", async () => {
    mocks.hasOrganizationMembership.mockResolvedValue(false);
    mocks.requireActiveOrganization.mockRejectedValue(
      new Error("Unexpected redirect to /projects"),
    );

    await expect(OrganizationPage()).resolves.toBeNull();
    expect(mocks.requireActiveOrganization).not.toHaveBeenCalled();
    expect(mocks.canManageOrganization).not.toHaveBeenCalled();
  });

  it("continues to Organization management for an active Membership", async () => {
    mocks.hasOrganizationMembership.mockResolvedValue(true);
    mocks.requireActiveOrganization.mockResolvedValue({
      session: { user: { email: "owner@example.invalid" } },
      organization: { name: "Organization" },
    });
    mocks.canManageOrganization.mockResolvedValue(true);

    expect(await OrganizationPage()).not.toBeNull();
    expect(mocks.requireActiveOrganization).toHaveBeenCalledOnce();
    expect(mocks.canManageOrganization).toHaveBeenCalledOnce();
  });
});
