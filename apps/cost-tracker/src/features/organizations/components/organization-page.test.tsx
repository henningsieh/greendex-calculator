// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasOrganizationMembership: vi.fn(),
  pageSection: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/session", () => ({
  hasOrganizationMembership: mocks.hasOrganizationMembership,
}));
vi.mock("@/features/organizations/components/organization-page-section", () => ({
  OrganizationPageSection: mocks.pageSection,
}));

import OrganizationPage from "@/features/organizations/components/organization-page";

describe("Organization page recovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("leaves creation recovery in place without rendering the section", async () => {
    mocks.hasOrganizationMembership.mockResolvedValue(false);

    await expect(OrganizationPage()).resolves.toBeNull();
    expect(mocks.pageSection).not.toHaveBeenCalled();
  });

  it("streams the section skeleton for an active Membership", async () => {
    mocks.hasOrganizationMembership.mockResolvedValue(true);

    expect(await OrganizationPage()).not.toBeNull();
  });
});
