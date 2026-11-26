// @vitest-environment node
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  claimHistoryTable as history,
  claimsTable as claims,
  member,
  notificationsTable as notifications,
  projectsTable as projects,
} from "@greendex/database/schema";
import { createClaimPaidEvent } from "@greendex/notifications";
import { createRouterClient } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const authMocks = vi.hoisted(() => ({ getSession: vi.fn() }));
const realtimeEnv = vi.hoisted(() => {
  const url = "http://realtime.test";
  const secret = "integration-realtime-secret-000000";
  process.env.REALTIME_INTERNAL_URL = url;
  process.env.REALTIME_EMIT_SECRET = secret;
  return { url, secret };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";

import { SEED_IDS } from "#repo/apps/calculator/scripts/seed-ids";
import { claimPaidNotificationIntent } from "@/features/claims/procedures/payment-notification";
import { notificationIntentFor } from "@/features/notifications/procedures/actions";
import { persistNotifications } from "@/features/notifications/procedures/writes";
import { router } from "@/lib/orpc/router";

const host = SEED_IDS.organization.claimHost;
const partner = SEED_IDS.organization.claimPartner;
const coordinator = SEED_IDS.user.claimCoordinator;
const participant = SEED_IDS.user.claimParticipant;
const owner = SEED_IDS.user.claimOwner;
const admin = SEED_IDS.user.costParticipantUser;
const unassignedCoordinator = SEED_IDS.user.entitySearchActor;
const project = SEED_IDS.project.claimProject3;
const partnership = SEED_IDS.partnership.claimOwn;

const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});
const temporaryMemberIds: string[] = [];
let claimId = "";
let fetchMock: ReturnType<typeof vi.fn>;
let consoleError: ReturnType<typeof vi.spyOn>;

function signIn(userId: string, activeOrganizationId: string | null) {
  authMocks.getSession.mockResolvedValue({
    user: { id: userId },
    session: { activeOrganizationId },
  });
}

async function clearPaymentFixture() {
  const existing = await db
    .select({ id: claims.id })
    .from(claims)
    .where(eq(claims.partnershipId, partnership));
  if (existing.length > 0)
    await db.delete(history).where(
      inArray(
        history.claimId,
        existing.map(({ id }) => id),
      ),
    );
  await db.delete(claims).where(eq(claims.partnershipId, partnership));
  if (claimId)
    await db.delete(notifications).where(eq(notifications.dedupeKey, claimId));
  if (temporaryMemberIds.length > 0)
    await db.delete(member).where(inArray(member.id, temporaryMemberIds));
  temporaryMemberIds.length = 0;
}

async function seedApprovedClaim() {
  claimId = `payment-notification-${randomUUID()}`;
  await db.insert(claims).values({
    id: claimId,
    partnershipId: partnership,
    status: "approved",
    reimbursementAmountEur: "1250.00",
  });
}

async function addTemporaryMember(userId: string, role: string) {
  const id = `payment-notification-member-${randomUUID()}`;
  temporaryMemberIds.push(id);
  await db.insert(member).values({
    id,
    organizationId: partner,
    userId,
    role,
    createdAt: new Date(),
  });
}

async function notificationRows() {
  return db
    .select({
      recipientUserId: notifications.recipientUserId,
      organizationId: notifications.organizationId,
      eventType: notifications.eventType,
      eventVersion: notifications.eventVersion,
      payload: notifications.payload,
    })
    .from(notifications)
    .where(eq(notifications.dedupeKey, claimId));
}

async function claimState() {
  const [row] = await db
    .select({ status: claims.status })
    .from(claims)
    .where(eq(claims.id, claimId));
  const historyRows = await db
    .select({ eventType: history.eventType })
    .from(history)
    .where(eq(history.claimId, claimId));
  return { status: row?.status, history: historyRows };
}

beforeAll(async () => {
  if (
    !(await db.query.projectsTable.findFirst({
      where: eq(projects.id, project),
    }))
  )
    throw new Error("Seed required: run the isolated seeded lifecycle.");
});

beforeEach(async () => {
  await clearPaymentFixture();
  await seedApprovedClaim();
  signIn(coordinator, host);
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", fetchMock);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await clearPaymentFixture();
  vi.unstubAllGlobals();
  consoleError.mockRestore();
  vi.clearAllMocks();
});

describe("claim.paid notification emission", () => {
  it("declares the notification intent on the markPaid router entry", () => {
    expect(notificationIntentFor(router.claims.markPaid)).toBe(
      claimPaidNotificationIntent,
    );
  });

  it("notifies assigned Partner coordinators plus Owners and Admins only", async () => {
    await addTemporaryMember(admin, ORGANIZATION_ROLES.OrganizationAdmin);
    await addTemporaryMember(
      unassignedCoordinator,
      ORGANIZATION_ROLES.ProjectCoordinator,
    );

    const result = await client.claims.markPaid({
      partnershipId: partnership,
      amountEur: "1250.00",
    });

    expect(result).toEqual({
      id: claimId,
      status: "paid",
      reimbursementAmountEur: "1250.00",
    });
    expect(await claimState()).toEqual({
      status: "paid",
      history: [{ eventType: "paid" }],
    });
    const rows = await notificationRows();
    expect(rows.map(({ recipientUserId }) => recipientUserId).sort()).toEqual(
      [admin, coordinator, owner].sort(),
    );
    expect(
      rows.every(
        ({ organizationId, eventType, eventVersion }) =>
          organizationId === partner &&
          eventType === "claim.paid" &&
          eventVersion === 1,
      ),
    ).toBe(true);
    expect(rows[0]?.payload).toMatchObject({
      projectId: project,
      partnershipId: partnership,
      claimId,
      amountEur: "1250.00",
      actorUserId: coordinator,
    });
    expect(
      rows.some(({ recipientUserId }) => recipientUserId === participant),
    ).toBe(false);
    expect(
      rows.some(
        ({ recipientUserId }) => recipientUserId === unassignedCoordinator,
      ),
    ).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("emits the personal-room envelope to the realtime service after commit", async () => {
    await client.claims.markPaid({
      partnershipId: partnership,
      amountEur: "1250.00",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${realtimeEnv.url}/emit`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: `Bearer ${realtimeEnv.secret}`,
        }),
      }),
    );
    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      notifications: {
        recipientUserId: string;
        notification: {
          id: string;
          event: { type: string; version: number; payload: unknown };
          createdAt: string;
        };
      }[];
    };
    expect(
      request.notifications.map(({ recipientUserId }) => recipientUserId).sort(),
    ).toEqual([coordinator, owner].sort());
    for (const { notification } of request.notifications) {
      expect(notification.id).toMatch(/^[\w-]+$/u);
      expect(notification.event).toMatchObject({
        type: "claim.paid",
        version: 1,
        payload: { claimId, amountEur: "1250.00", actorUserId: coordinator },
      });
      expect(Number.isNaN(Date.parse(notification.createdAt))).toBe(false);
    }
  });

  it("keeps the payment and inbox rows when the emit fails", async () => {
    fetchMock.mockRejectedValue(new Error("connection refused"));

    await expect(
      client.claims.markPaid({
        partnershipId: partnership,
        amountEur: "1250.00",
      }),
    ).resolves.toMatchObject({ status: "paid" });

    expect(await claimState()).toEqual({
      status: "paid",
      history: [{ eventType: "paid" }],
    });
    expect(await notificationRows()).toHaveLength(2);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("notification rows remain for catch-up"),
      expect.any(Error),
    );
  });

  it("repeating the confirmed payment adds no row, history entry, or emit", async () => {
    await client.claims.markPaid({
      partnershipId: partnership,
      amountEur: "1250.00",
    });
    fetchMock.mockClear();

    await expect(
      client.claims.markPaid({
        partnershipId: partnership,
        amountEur: "1250.00",
      }),
    ).resolves.toMatchObject({ status: "paid" });

    expect(await notificationRows()).toHaveLength(2);
    expect(await claimState()).toEqual({
      status: "paid",
      history: [{ eventType: "paid" }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rolls the notification write back with the claim change on failure", async () => {
    const event = createClaimPaidEvent({
      projectId: project,
      partnershipId: partnership,
      claimId,
      amountEur: "1250.00",
      actorUserId: coordinator,
    });

    await expect(
      db.transaction(async (tx) => {
        await tx
          .update(claims)
          .set({ status: "paid" })
          .where(eq(claims.id, claimId));
        await tx.insert(history).values({
          claimId,
          actorUserId: coordinator,
          eventType: "paid",
        });
        await persistNotifications(tx, {
          event,
          actorUserId: coordinator,
          recipients: [
            { userId: `missing-user-${randomUUID()}`, organizationId: partner },
          ],
        });
      }),
    ).rejects.toThrow();

    expect(await claimState()).toEqual({
      status: "approved",
      history: [],
    });
    expect(await notificationRows()).toEqual([]);
  });
});
