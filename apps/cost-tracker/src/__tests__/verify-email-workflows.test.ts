// @vitest-environment node
import { createServer } from "node:http";

import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
  environments: [] as Record<string, string>[],
}));
vi.mock("../../scripts/email-inbox", () => ({
  EmailInbox: class {
    constructor(environment: Record<string, string>) {
      fixtures.environments.push(environment);
    }
    connect = fixtures.connect;
    cleanup = async () => ({ retained: 0, deleted: 0 });
  },
}));
vi.mock("pg", () => ({
  Pool: class {
    query = fixtures.query;
    end = fixtures.end;
  },
}));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({}) }));
vi.mock("../../scripts/email-run-safety", () => ({
  validateMailboxEnvironment: vi.fn(),
}));

import {
  HttpSession,
  resolveExistingIntegrationSeed,
  verifyEmailWorkflows,
} from "../../scripts/verify-email-workflows";

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.environments.length = 0;
  fixtures.end.mockResolvedValue(undefined);
});

describe("verify-email-workflows request cancellation", () => {
  it.each(["HTTP", "RPC", "RPC caller"])(
    "cancels a pending %s request without waiting for its timeout",
    async (kind) => {
      const received = Promise.withResolvers<string>();
      const disconnected = Promise.withResolvers<void>();
      const server = createServer((request, response) => {
        received.resolve(request.url ?? "");
        response.on("close", () => disconnected.resolve());
      });
      server.setTimeout(1_000, (socket) => socket.destroy());
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const controller = new AbortController();
      try {
        const address = server.address();
        if (!address || typeof address === "string")
          throw new Error("Expected a TCP listener.");
        const session = new HttpSession(
          `http://127.0.0.1:${address.port}`,
          kind === "RPC caller" ? undefined : controller.signal,
        );
        const pending =
          kind === "HTTP"
            ? session.request("/pending")
            : session.rpc().participantOnboarding.listMyProjects(undefined, {
                signal: kind === "RPC caller" ? controller.signal : undefined,
              });
        const cancelled = expect(pending).rejects.toMatchObject({
          name: "AbortError",
        });
        expect(await received.promise).toBe(
          kind === "HTTP"
            ? "/pending"
            : "/api/rpc/participantOnboarding/listMyProjects",
        );
        controller.abort();
        await cancelled;
        await disconnected.promise;
      } finally {
        controller.abort();
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  );

  it.each(["HTTP", "RPC"])(
    "rejects a new %s request after interruption",
    async (kind) => {
      const controller = new AbortController();
      controller.abort();
      const session = new HttpSession("http://127.0.0.1:1", controller.signal);
      const pending =
        kind === "HTTP"
          ? session.request("/pending")
          : session.rpc().participantOnboarding.listMyProjects();
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    },
  );
});

describe("verify-email-workflows response validation", () => {
  it("returns parsed auth data and carries session cookies to the next request", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: "created-user" } }), {
        headers: { "set-cookie": "session=owned; HttpOnly; Path=/" },
      }),
    );
    fetch.mockResolvedValueOnce(new Response("{}"));
    try {
      const session = new HttpSession("http://127.0.0.1:1234");
      expect(await session.auth("sign-up/email")).toEqual({
        user: { id: "created-user" },
      });
      await session.request("/next");
      expect(fetch.mock.lastCall?.[1]?.headers).toMatchObject({
        cookie: "session=owned",
      });
    } finally {
      fetch.mockRestore();
    }
  });

  it.each([
    { payload: [] },
    { payload: [{ id: "owned-org", name: "Organization" }] },
  ])("accepts organization/list arrays %#", async ({ payload }) => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(payload)));
    try {
      expect(
        await new HttpSession("http://127.0.0.1:1234").auth("organization/list"),
      ).toEqual(payload);
    } finally {
      fetch.mockRestore();
    }
  });

  it.each([null, {}, [null], ["org"], [{ id: 42 }]])(
    "rejects malformed organization/list JSON %#",
    async (payload) => {
      const fetch = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(JSON.stringify(payload)));
      try {
        await expect(
          new HttpSession("http://127.0.0.1:1234").auth("organization/list"),
        ).rejects.toThrow("Supported auth response was invalid.");
      } finally {
        fetch.mockRestore();
      }
    },
  );

  it.each([null, [], 42, "invalid"])(
    "rejects non-record auth JSON %#",
    async (payload) => {
      const fetch = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(JSON.stringify(payload)));
      try {
        await expect(
          new HttpSession("http://127.0.0.1:1234").auth("get-session"),
        ).rejects.toThrow("Supported auth response was invalid.");
      } finally {
        fetch.mockRestore();
      }
    },
  );

  it.each([null, [], { email: "actor@example.test", emailVerified: "true" }])(
    "rejects malformed signed-in user data %#",
    async (user) => {
      const fetch = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("{}"))
        .mockResolvedValueOnce(new Response(JSON.stringify({ user })));
      try {
        await expect(
          new HttpSession("http://127.0.0.1:1234").signIn(
            "actor@example.test",
            "password",
          ),
        ).rejects.toThrow("Verified sign-in was not established.");
      } finally {
        fetch.mockRestore();
      }
    },
  );
});

describe("existing mail environment", () => {
  const databaseUrl = "postgres://188.245.144.137:5489/greendex_development";

  it("reads existing seed identities and closes its own pool", async () => {
    fixtures.query.mockResolvedValueOnce({
      rows: [
        { id: "existing-host", slug: "seed-org" },
        { id: "existing-partner", slug: "seed-second-partner-org" },
      ],
    });
    expect(await resolveExistingIntegrationSeed(databaseUrl)).toEqual({
      organizationId: "existing-host",
      secondPartnerOrganizationId: "existing-partner",
    });
    expect(fixtures.query.mock.lastCall).toEqual([
      "SELECT id, slug FROM organization WHERE slug = ANY($1::text[])",
      [["seed-org", "seed-second-partner-org"]],
    ]);
    expect(fixtures.end.mock.calls).toEqual([[]]);
  });

  it("fails missing seed identities without reseeding", async () => {
    fixtures.query.mockResolvedValueOnce({ rows: [] });
    await expect(resolveExistingIntegrationSeed(databaseUrl)).rejects.toThrow(
      "Required existing seed Organizations are missing",
    );
    expect(fixtures.end.mock.calls).toEqual([[]]);
  });

  it("fails missing IMAP, retains mail, closes its pool and suppresses private failures", async () => {
    fixtures.connect.mockRejectedValue(new Error("private.test password=SECRET"));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        await verifyEmailWorkflows({
          apps: ["cost-tracker"],
          context: {
            kind: "existing-environment",
            correlationId: "11111111-2222-4333-8444-555555555555",
            databaseUrl,
            apps: {
              "cost-tracker": {
                baseUrl: "http://127.0.0.1:3002",
                environment: {
                  NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3002",
                  DELETE_TESTMAILS_DURING_TESTRUN: "true",
                },
              },
            },
            seed: {
              organizationId: "existing-host",
              secondPartnerOrganizationId: "existing-partner",
            },
          },
        }),
      ).toBe(false);
      expect(fixtures.environments).toEqual([
        {
          NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3002",
          DELETE_TESTMAILS_DURING_TESTRUN: "false",
        },
      ]);
      expect(fixtures.end.mock.calls).toEqual([[]]);
      const output = [...log.mock.calls, ...error.mock.calls].flat().join("\n");
      expect(output).toContain("FAILED cost-tracker/imap");
      expect(output).toContain("BLOCKED cost-tracker/signup-verification");
      expect(output).not.toContain("SECRET");
      expect(output).not.toContain("private.test");
      expect(output).not.toContain(databaseUrl);
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });
});
