// @vitest-environment node
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  notificationsTable as notifications,
  user as users,
} from "@greendex/database/schema";
import { createClaimPaidEvent } from "@greendex/notifications";
import { createRouterClient } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const authMocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));

import { SEED_IDS } from "#repo/apps/calculator/scripts/seed-ids";
import {
  persistNotifications,
  type NotificationRecipient,
} from "@/features/notifications/procedures/writes";
import { router } from "@/lib/orpc/router";

const recipient = `notification-test-recipient-${randomUUID()}`;
const colleague = `notification-test-colleague-${randomUUID()}`;
const actor = `notification-test-actor-${randomUUID()}`;
const partnerOrganization = SEED_IDS.organization.claimPartner;
const hostOrganization = SEED_IDS.organization.claimHost;

const testUserIds = [recipient, colleague, actor];
const claimIds = new Set<string>();
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});

function nextClaimId(): string {
  const id = `notification-test-${randomUUID()}`;
  claimIds.add(id);
  return id;
}

function claimPaidEvent(claimId: string) {
  return createClaimPaidEvent({
    projectId: "notification-test-project",
    partnershipId: "notification-test-partnership",
    claimId,
    amountEur: "1250.00",
    actorUserId: actor,
  });
}

async function seedNotifications(
  recipients: NotificationRecipient[],
  claimId = nextClaimId(),
) {
  const event = claimPaidEvent(claimId);
  const ids = await db.transaction((tx) =>
    persistNotifications(tx, { event, actorUserId: actor, recipients }),
  );
  return { event, ids, claimId };
}

async function rowsFor(claimId: string) {
  return db
    .select({
      id: notifications.id,
      recipientUserId: notifications.recipientUserId,
      organizationId: notifications.organizationId,
      readAt: notifications.readAt,
      payload: notifications.payload,
    })
    .from(notifications)
    .where(eq(notifications.dedupeKey, claimId));
}

async function clearTestNotifications() {
  if (claimIds.size === 0) return;
  await db
    .delete(notifications)
    .where(inArray(notifications.dedupeKey, [...claimIds]));
  claimIds.clear();
}

function signIn(userId: string, activeOrganizationId: string | null) {
  authMocks.getSession.mockResolvedValue({
    user: { id: userId },
    session: { activeOrganizationId },
  });
}

beforeAll(async () => {
  await db.insert(users).values(
    testUserIds.map((id) => ({
      id,
      name: `Notification test ${id.slice(-8)}`,
      email: `${id}@example.org`,
      emailVerified: true,
    })),
  );
});

afterAll(async () => {
  await clearTestNotifications();
  await db.delete(users).where(inArray(users.id, testUserIds));
});

beforeEach(async () => {
  await clearTestNotifications();
  signIn(recipient, partnerOrganization);
});

afterEach(clearTestNotifications);

describe("notification inbox persistence", () => {
  it("writes one row per recipient and makes repeated events duplicate-safe", async () => {
    const claimId = nextClaimId();
    const event = claimPaidEvent(claimId);
    const recipients = [
      { userId: recipient, organizationId: partnerOrganization },
      { userId: recipient, organizationId: partnerOrganization },
      { userId: colleague, organizationId: partnerOrganization },
    ];

    const first = await db.transaction((tx) =>
      persistNotifications(tx, { event, actorUserId: actor, recipients }),
    );
    const second = await db.transaction((tx) =>
      persistNotifications(tx, { event, actorUserId: actor, recipients }),
    );

    expect(first).toHaveLength(2);
    expect(second).toEqual([]);
    const rows = await rowsFor(claimId);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.payload)).toEqual([
      event.payload,
      event.payload,
    ]);
    expect(rows.every((row) => row.readAt === null)).toBe(true);
  });

  it("writes nothing when recipient resolution yields nobody", async () => {
    const claimId = nextClaimId();
    const ids = await db.transaction((tx) =>
      persistNotifications(tx, {
        event: claimPaidEvent(claimId),
        actorUserId: actor,
        recipients: [],
      }),
    );
    expect(ids).toEqual([]);
    expect(await rowsFor(claimId)).toEqual([]);
  });
});

describe("notification inbox reads", () => {
  it("lists only the caller's unread rows in the active Organization", async () => {
    const mine = await seedNotifications([
      { userId: recipient, organizationId: partnerOrganization },
    ]);
    const otherOrganization = await seedNotifications([
      { userId: recipient, organizationId: hostOrganization },
    ]);
    const foreign = await seedNotifications([
      { userId: colleague, organizationId: partnerOrganization },
    ]);
    const read = await seedNotifications([
      { userId: recipient, organizationId: partnerOrganization },
    ]);
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.dedupeKey, read.claimId));

    // Both scoped rows exist; only the active Organization's unread row lists.
    expect(await rowsFor(otherOrganization.claimId)).toHaveLength(1);
    expect(await rowsFor(foreign.claimId)).toHaveLength(1);

    const result = await client.notifications.listUnread({});

    expect(result.unreadCount).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: mine.ids[0]?.id,
      event: mine.event,
    });
    expect(result.items.map((item) => item.event.payload.claimId)).toEqual([
      mine.claimId,
    ]);
  });

  it("keeps the unread count independent of the page limit", async () => {
    const first = await seedNotifications(
      [{ userId: recipient, organizationId: partnerOrganization }],
      nextClaimId(),
    );
    const second = await seedNotifications(
      [{ userId: recipient, organizationId: partnerOrganization }],
      nextClaimId(),
    );

    const result = await client.notifications.listUnread({ limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.unreadCount).toBe(2);
    const [item] = result.items;
    if (!item) throw new Error("Expected one unread notification");
    expect([first.claimId, second.claimId]).toContain(item.event.payload.claimId);
  });

  it("marks only the caller's own rows in the active Organization read", async () => {
    const own = await seedNotifications([
      { userId: recipient, organizationId: partnerOrganization },
    ]);
    const alsoOwn = await seedNotifications([
      { userId: recipient, organizationId: partnerOrganization },
    ]);
    const foreign = await seedNotifications([
      { userId: colleague, organizationId: partnerOrganization },
    ]);
    const otherOrganization = await seedNotifications([
      { userId: recipient, organizationId: hostOrganization },
    ]);

    const result = await client.notifications.markRead({
      ids: [own.ids[0]!.id, foreign.ids[0]!.id],
    });

    expect(result).toEqual({ updated: 1, unreadCount: 1 });
    const [ownRow] = await rowsFor(own.claimId);
    const [foreignRow] = await rowsFor(foreign.claimId);
    const [otherOrganizationRow] = await rowsFor(otherOrganization.claimId);
    const [alsoOwnRow] = await rowsFor(alsoOwn.claimId);
    expect(ownRow?.readAt).toBeInstanceOf(Date);
    expect(alsoOwnRow?.readAt).toBeNull();
    expect(foreignRow?.readAt).toBeNull();
    expect(otherOrganizationRow?.readAt).toBeNull();
  });

  it("marks all of the caller's unread rows read without crossing Organizations", async () => {
    const first = await seedNotifications([
      { userId: recipient, organizationId: partnerOrganization },
    ]);
    const second = await seedNotifications([
      { userId: recipient, organizationId: partnerOrganization },
    ]);
    const foreign = await seedNotifications([
      { userId: colleague, organizationId: partnerOrganization },
    ]);
    const otherOrganization = await seedNotifications([
      { userId: recipient, organizationId: hostOrganization },
    ]);

    const result = await client.notifications.markAllRead();

    expect(result).toEqual({ updated: 2, unreadCount: 0 });
    expect((await rowsFor(first.claimId))[0]?.readAt).toBeInstanceOf(Date);
    expect((await rowsFor(second.claimId))[0]?.readAt).toBeInstanceOf(Date);
    expect((await rowsFor(foreign.claimId))[0]?.readAt).toBeNull();
    expect((await rowsFor(otherOrganization.claimId))[0]?.readAt).toBeNull();
  });

  it("requires an active Organization for inbox reads", async () => {
    signIn(recipient, null);

    await expect(client.notifications.listUnread({})).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    });
    await expect(
      client.notifications.markRead({ ids: ["any"] }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    });
    await expect(client.notifications.markAllRead()).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    });
  });
});
