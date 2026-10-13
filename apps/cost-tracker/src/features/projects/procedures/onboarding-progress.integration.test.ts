// @vitest-environment node
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import { projectsTable as projects } from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { beforeEach, beforeAll, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));

import { createOnboardingProgressProcedure } from "@/features/projects/procedures/onboarding-progress";

// Stable identities registered in SEED_SCENARIOS.costTrackerOnboardingProgress.
const suffix = "canonical";
const host = `progress-host-${suffix}`;
const partner = `progress-partner-${suffix}`;
const project = `progress-project-${suffix}`;
const own = `progress-own-${suffix}`;
const foreign = `progress-foreign-${suffix}`;
const coordinator = `progress-coordinator-${suffix}`;
const joined = `progress-joined-${suffix}`;
const pending = `progress-pending-${suffix}`;
const revoked = `progress-revoked-${suffix}`;
const outsider = `progress-outsider-${suffix}`;
const mail = (key: string) => `${key}-${suffix}@example.org`;
const version = { id: "fixture-v2", contentHash: "fixture-hash-v2" };
let actor = coordinator;
let activeOrg = partner;
let agreement = version;
const client = createRouterClient(
  { progress: createOnboardingProgressProcedure(() => agreement) },
  { context: async () => ({ headers: new Headers() }) },
);

beforeAll(async () => {
  if (
    !(await db.query.projectsTable.findFirst({ where: eq(projects.id, project) }))
  )
    throw new Error(
      "Canonical seed required: run the isolated seeded lifecycle.",
    );
  authMocks.getSession.mockImplementation(async () => ({
    user: { id: actor },
    session: { activeOrganizationId: activeOrg },
  }));
});

// ADR-0005: "A known-email path uses a Better Auth Invitation to the Hosting Organization with the `participant` role."
// #263 governs this seam instead: Participant Invitations are app-owned and Partner-initiated.
beforeEach(() => {
  actor = coordinator;
  activeOrg = partner;
  agreement = version;
});

describe("Partner invitee onboarding progress", () => {
  it("deduplicates reissues, joins and revoked history without exposing another Partnership", async () => {
    const rows = await client.progress({ partnershipId: own });
    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.email === null)).toMatchObject({
      participationId: expect.any(String),
      participation: "joined",
      profile: "missing",
      agreement: "missing",
      membership: "missing",
      bridge: "none",
    });
    expect(rows.find((row) => row.email === mail(joined))).toMatchObject({
      participationId: expect.any(String),
      participation: "joined",
      profile: "complete",
      agreement: "current",
      membership: ORGANIZATION_ROLES.Participant,
      bridge: "pending",
    });
    expect(rows.find((row) => row.email === mail(pending))).toMatchObject({
      participationId: null,
      participation: "not-joined",
      invitationId: `new-${suffix}`,
      profile: "complete",
      agreement: "outdated",
      membership: "missing",
      bridge: "pending",
    });
    expect(rows.find((row) => row.email === mail(revoked))).toMatchObject({
      profile: "missing",
      agreement: "missing",
      membership: "missing",
      bridge: "revoked",
    });
    expect(rows.some((row) => row.email === mail(outsider))).toBe(false);
  });

  it("does not claim an unpublished agreement is current", async () => {
    agreement = { id: "PENDING-LEGAL-001", contentHash: "" };
    try {
      const rows = await client.progress({ partnershipId: own });
      expect(rows.find((row) => row.email === mail(joined))?.agreement).toBe(
        "unavailable",
      );
      expect(rows.find((row) => row.email === mail(pending))?.agreement).toBe(
        "unavailable",
      );
    } finally {
      agreement = version;
    }
  });

  it("requires the current content hash and reports expired invitations", async () => {
    agreement = { ...version, contentHash: "superseded-current-version-hash" };
    const rows = await client.progress({
      partnershipId: "progress-expired-partnership-canonical",
    });
    expect(rows.find((row) => row.email === mail(joined))?.agreement).toBe(
      "outdated",
    );
    expect(rows.find((row) => row.email === mail(pending))?.bridge).toBe(
      "expired",
    );
  });

  it("denies foreign scope, Host-side access and Participants", async () => {
    await expect(
      client.progress({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    activeOrg = host;
    await expect(client.progress({ partnershipId: own })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    activeOrg = partner;
    actor = joined;
    await expect(client.progress({ partnershipId: own })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    actor = coordinator;
  });
});
