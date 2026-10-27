import { FEATURE_FLAGS, resolveFlags } from "@greendex/config/feature-flags";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("feature flags", () => {
  it("defaults every flag to off (safe)", () => {
    expect(FEATURE_FLAGS.singleOrganization).toBe(false);
    expect(resolveFlags()).toEqual({ singleOrganization: false });
  });

  it("accepts per-app overrides", () => {
    expect(resolveFlags({ singleOrganization: true })).toEqual({
      singleOrganization: true,
    });
  });
});

const policyDb = vi.hoisted(() => ({
  membership: vi.fn(),
  account: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@greendex/database", () => ({
  db: {
    query: {
      member: { findFirst: policyDb.membership },
      user: { findFirst: policyDb.account },
    },
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({ orderBy: () => ({ limit: policyDb.limit }) }),
        }),
      }),
    }),
  },
}));

import {
  canCreateOrganization,
  getOrganizationCreationEligibility,
} from "./server-auth";

describe("Organization creation policy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    policyDb.limit.mockResolvedValue([]);
  });

  it("preserves default-off multi-Organization creation", async () => {
    expect(
      await getOrganizationCreationEligibility("user", "recipient@example.org", {
        singleOrganization: false,
      }),
    ).toEqual({ status: "allowed" });
  });

  it("keeps membership an independent refusal", async () => {
    policyDb.membership.mockResolvedValue({ id: "membership" });
    expect(
      await getOrganizationCreationEligibility("user", "recipient@example.org", {
        singleOrganization: true,
      }),
    ).toEqual({ status: "denied-membership" });
  });

  it("returns the actionable invitation and denies the boolean adapter", async () => {
    const blocking = {
      invitationId: "invitation",
      organization: { id: "org", name: "Colleagues" },
    };
    policyDb.limit.mockResolvedValue([blocking]);
    policyDb.account.mockResolvedValue({ email: "recipient@example.org" });
    expect(
      await getOrganizationCreationEligibility("user", "recipient@example.org", {
        singleOrganization: true,
      }),
    ).toEqual({ status: "denied-invitation", ...blocking });
    expect(
      await canCreateOrganization("user", { singleOrganization: true }),
    ).toBe(false);
  });

  it("permits independent creation without a blocking invitation", async () => {
    expect(
      await getOrganizationCreationEligibility("user", "recipient@example.org", {
        singleOrganization: true,
      }),
    ).toEqual({ status: "allowed" });
  });
});
