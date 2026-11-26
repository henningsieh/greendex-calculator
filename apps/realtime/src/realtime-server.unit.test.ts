// @vitest-environment node
import { randomUUID } from "node:crypto";

import {
  NOTIFICATION_CREATED_EVENT,
  createClaimPaidEvent,
  type NotificationCreated,
} from "@greendex/notifications";
import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import { createRealtimeServer, type RealtimeServer } from "./realtime-server";
import type { SessionIdentity } from "./session-validator";

const emitSecret = "realtime-unit-secret-000000";
const corsOrigin = "http://localhost:3002";
const clients: Socket[] = [];
let server: RealtimeServer | undefined;

const sessionValidator = async (
  cookie: string | undefined,
): Promise<SessionIdentity | null> => {
  if (cookie?.includes("session=alice")) return { userId: "alice" };
  if (cookie?.includes("session=bob")) return { userId: "bob" };
  return null;
};

async function startServer(
  validator: (
    cookie: string | undefined,
  ) => Promise<SessionIdentity | null> = sessionValidator,
): Promise<string> {
  server = createRealtimeServer({
    host: "127.0.0.1",
    port: 0,
    corsOrigin,
    emitSecret,
    sessionValidator: validator,
  });
  const { port } = await server.start();
  return `http://127.0.0.1:${port}`;
}

function connect(
  url: string,
  cookie?: string,
  origin: string | null = corsOrigin,
): Socket {
  const client = createClient(url, {
    reconnection: false,
    forceNew: true,
    extraHeaders: {
      ...(origin ? { origin } : {}),
      ...(cookie ? { cookie } : {}),
    },
  });
  clients.push(client);
  return client;
}

function waitForConnect(client: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("connect timed out")), 2000);
    client.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    client.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForConnectError(client: Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("connect_error timed out")),
      2000,
    );
    client.once("connect_error", (error: Error) => {
      clearTimeout(timer);
      resolve(error.message);
    });
    client.once("connect", () => {
      clearTimeout(timer);
      reject(new Error("client connected unexpectedly"));
    });
  });
}

function waitForNotification(
  client: Socket,
  timeoutMs = 2000,
): Promise<NotificationCreated> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("notification timed out")),
      timeoutMs,
    );
    client.once(NOTIFICATION_CREATED_EVENT, (notification) => {
      clearTimeout(timer);
      resolve(notification);
    });
  });
}

function notificationFixture(): NotificationCreated {
  return {
    id: `notification-${randomUUID()}`,
    event: createClaimPaidEvent({
      projectId: "project-1",
      partnershipId: "partnership-1",
      claimId: "claim-1",
      amountEur: "1250.00",
      actorUserId: "actor-1",
    }),
    createdAt: new Date().toISOString(),
  };
}

async function emit(
  url: string,
  notifications: { recipientUserId: string; notification: NotificationCreated }[],
  authorization: string | null = `Bearer ${emitSecret}`,
): Promise<Response> {
  return fetch(`${url}/emit`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization === null ? {} : { authorization }),
    },
    body: JSON.stringify({ notifications }),
  });
}

afterEach(async () => {
  for (const client of clients) client.disconnect();
  clients.length = 0;
  await server?.stop();
  server = undefined;
});

describe("realtime notifications service", () => {
  it("serves health and rejects sockets without a valid session", async () => {
    const url = await startServer();
    expect((await fetch(`${url}/health`)).status).toBe(200);
    expect(await (await fetch(`${url}/health`)).json()).toEqual({
      status: "ok",
    });

    await expect(waitForConnectError(connect(url))).resolves.toBe("unauthorized");
    await expect(
      waitForConnectError(connect(url, "session=unknown")),
    ).resolves.toBe("unauthorized");
  });

  it("rejects a foreign browser origin before session validation", async () => {
    const url = await startServer();
    await expect(
      waitForConnectError(connect(url, "session=alice", "http://evil.test")),
    ).resolves.toBeTruthy();
  });

  it("admits a same-origin request that omits the Origin header", async () => {
    const url = await startServer();
    const alice = connect(url, "session=alice", null);
    await expect(waitForConnect(alice)).resolves.toBeUndefined();
  });

  it("reports an unavailable session check for a bounded client retry", async () => {
    const url = await startServer(async () => {
      throw new Error("auth service down");
    });
    await expect(
      waitForConnectError(connect(url, "session=alice")),
    ).resolves.toBe("session_unavailable");
  });

  it("delivers only to the recipient's personal room", async () => {
    const url = await startServer();
    const alice = connect(url, "session=alice");
    const bob = connect(url, "session=bob");
    await Promise.all([waitForConnect(alice), waitForConnect(bob)]);
    await new Promise((resolve) => setTimeout(resolve, 100));

    let bobReceived = false;
    bob.on(NOTIFICATION_CREATED_EVENT, () => {
      bobReceived = true;
    });
    const notification = notificationFixture();

    const received = waitForNotification(alice);
    const response = await emit(url, [
      { recipientUserId: "alice", notification },
    ]);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: 1 });
    await expect(received).resolves.toEqual(notification);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(bobReceived).toBe(false);
  });

  it("rejects an invalid emit secret or invalid payload without broadcasting", async () => {
    const url = await startServer();
    const alice = connect(url, "session=alice");
    await waitForConnect(alice);
    let received = false;
    alice.on(NOTIFICATION_CREATED_EVENT, () => {
      received = true;
    });

    expect((await emit(url, [], null)).status).toBe(401);
    expect((await emit(url, [], "Bearer wrong-secret-000000")).status).toBe(401);
    const invalid = await fetch(`${url}/emit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${emitSecret}`,
      },
      body: JSON.stringify({ notifications: [{ recipientUserId: "" }] }),
    });
    expect(invalid.status).toBe(400);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(received).toBe(false);
  });

  it("treats an offline recipient as a successful no-op with no replay", async () => {
    const url = await startServer();
    const notification = notificationFixture();

    const response = await emit(url, [
      { recipientUserId: "alice", notification },
    ]);
    expect(response.status).toBe(202);

    const alice = connect(url, "session=alice");
    await waitForConnect(alice);
    let received = false;
    alice.on(NOTIFICATION_CREATED_EVENT, () => {
      received = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(received).toBe(false);
  });
});
