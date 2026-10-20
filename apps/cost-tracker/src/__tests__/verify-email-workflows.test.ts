// @vitest-environment node
/* eslint-disable import/no-relative-parent-imports -- Focused runner regression across app contexts. */
import { createServer } from "node:http";
import { basename } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const diagnostics = vi.hoisted(() => ({ connect: vi.fn(), boundary: vi.fn() }));
vi.mock("../../scripts/email-inbox", () => ({
  EmailInbox: class {
    connect = diagnostics.connect;
    boundary = diagnostics.boundary;
    cleanup = async () => ({ retained: 0, deleted: 0 });
  },
}));
vi.mock("@greendex/email", () => ({
  createTransporter: () => ({
    verify: async () => {
      throw Object.assign(new Error("private SMTP failure"), { code: "EAUTH" });
    },
    close: () => {},
  }),
}));
vi.mock("pg", () => ({
  Pool: class {
    end = async () => {};
  },
}));
vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: () => ({
    select: () => ({ from: () => ({ where: async () => [] }) }),
  }),
}));

const lifecycle = vi.hoisted(() => ({
  create: vi.fn(),
  dispose: vi.fn(),
  write: vi.fn(),
  seedModules: new Map<string, string>(),
}));
vi.mock(
  "../../../calculator/src/__tests__/helpers/isolated-run-database",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../calculator/src/__tests__/helpers/isolated-run-database")
    >()),
    createIsolatedRunDatabase: lifecycle.create,
    disposeIsolatedRunDatabase: lifecycle.dispose,
  }),
);
vi.mock("../../../../scripts/managed-app-servers", () => ({
  readLocalEnvironment: async () => ({
    DATABASE_URL: "postgres://postgres@localhost/postgres",
  }),
  startManagedAppServers: vi.fn(),
}));
vi.mock("../../scripts/email-run-safety", () => ({
  validateMailboxEnvironment: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  readFile: async (path: string) =>
    lifecycle.seedModules.get(basename(path)) ?? "seed",
  writeFile: lifecycle.write,
}));

import { SEED_SCENARIOS } from "../../../calculator/scripts/seed";
import {
  IsolatedRunCreationError,
  type IsolatedRunHandle,
} from "../../../calculator/src/__tests__/helpers/isolated-run-database";
import {
  HttpSession,
  verifyEmailWorkflows,
} from "../../scripts/verify-email-workflows";

beforeEach(() => {
  vi.clearAllMocks();
  lifecycle.seedModules.clear();
  lifecycle.dispose.mockResolvedValue(undefined);
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

describe("verify-email-workflows seed provenance", () => {
  it.each([
    "seed.ts",
    "seed-cost-tracker.ts",
    "seed-scenarios.ts",
    "seed-tables.ts",
    "seed-review-scenarios.ts",
  ])("changes the email report version when %s changes", async (name) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const reportVersion = async () => {
      lifecycle.create.mockRejectedValueOnce(new Error("preparation failed"));
      expect(await verifyEmailWorkflows()).toBe(false);
      return JSON.parse(lifecycle.write.mock.lastCall![1]).seedVersion;
    };
    try {
      const version = await reportVersion();
      expect(await reportVersion()).toBe(version);
      lifecycle.seedModules.set(name, `changed ${name}`);
      expect(await reportVersion()).not.toBe(version);
    } finally {
      log.mockRestore();
    }
  });
});

describe("verify-email-workflows creation failure cleanup", () => {
  it.each(["connection-close-after-prepare", "failed rollback"])(
    "captures and disposes the handle after %s",
    async () => {
      const handle: IsolatedRunHandle = {
        runId: "a".repeat(32),
        databaseName: `email_check_${"a".repeat(32)}`,
        databaseUrl: "postgres://postgres@localhost/owned",
        baseDatabaseUrl: "postgres://postgres@localhost/postgres",
        baseDatabaseName: "postgres",
        serviceHost: "localhost",
        servicePort: "5432",
        createdAt: new Date().toISOString(),
      };
      lifecycle.create.mockRejectedValueOnce(
        new IsolatedRunCreationError(handle, "failed", new Error("private")),
      );
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        expect(await verifyEmailWorkflows()).toBe(false);
        expect(lifecycle.dispose).toHaveBeenCalledWith(handle);
        const report = JSON.parse(lifecycle.write.mock.lastCall![1]);
        expect(report.cleanup.database).toBe("disposed");
        expect(report.runId).toBe(handle.runId);
      } finally {
        log.mockRestore();
      }
    },
  );

  it("preserves completed rollback without retrying disposal", async () => {
    const handle = {
      runId: "a".repeat(32),
      databaseName: "owned",
    } as IsolatedRunHandle;
    lifecycle.create.mockRejectedValueOnce(
      new IsolatedRunCreationError(handle, "disposed", new Error("private")),
    );
    lifecycle.dispose.mockRejectedValueOnce(
      new Error("already disposed; ownership marker absent"),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      expect(await verifyEmailWorkflows()).toBe(false);
      expect(lifecycle.dispose).not.toHaveBeenCalled();
      const report = JSON.parse(lifecycle.write.mock.lastCall![1]);
      expect(report.cleanup.database).toBe("disposed");
      expect(report.runId).toBe(handle.runId);
    } finally {
      log.mockRestore();
      lifecycle.dispose.mockReset().mockResolvedValue(undefined);
    }
  });

  it("reports failed disposal rather than not-created when recovery fails", async () => {
    const handle = {
      runId: "a".repeat(32),
      databaseName: "owned",
    } as IsolatedRunHandle;
    lifecycle.create.mockRejectedValueOnce(
      new IsolatedRunCreationError(handle, "failed", new Error("private")),
    );
    lifecycle.dispose.mockRejectedValueOnce(
      new Error("private disposal failure"),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      expect(await verifyEmailWorkflows()).toBe(false);
      expect(lifecycle.dispose).toHaveBeenCalledWith(handle);
      const report = JSON.parse(lifecycle.write.mock.lastCall![1]);
      expect(report.cleanup.database).toBe("failed");
    } finally {
      log.mockRestore();
    }
  });
});

describe("verify-email-workflows failure diagnostics", () => {
  it.each(["connect", "boundary"] as const)(
    "redacts private failures at %s",
    async (operation) => {
      const privateData =
        "https://private.test/reset?token=SECRET user@private.test password=SECRET";
      diagnostics.connect.mockResolvedValue(undefined);
      diagnostics.boundary.mockResolvedValue(1);
      diagnostics[operation].mockRejectedValue(new Error(privateData));
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(
          await verifyEmailWorkflows({
            handle: {
              runId: "a".repeat(32),
              databaseName: "owned",
              databaseUrl: "postgres://localhost/owned",
              baseDatabaseUrl: "postgres://localhost/postgres",
              baseDatabaseName: "postgres",
              serviceHost: "localhost",
              servicePort: "5432",
              createdAt: "2026-01-01T00:00:00Z",
            },
            servers: {
              calculatorBaseUrl: "http://127.0.0.1:1234",
              costTrackerBaseUrl: "http://127.0.0.1:1235",
              environment: {},
              stop: async () => {},
            },
            seed: {
              userId: "seed-user",
              organizationId: "seed-org",
              projectIds: [],
              partnerOrganizationId: "partner",
              secondPartnerOrganizationId: "second",
              thirdPartnerOrganizationId: "third",
              partnerProjectId: "partner-project",
              travelLegsEnsured: 0,
              scenarios: SEED_SCENARIOS,
            },
          }),
        ).toBe(false);
        const report = JSON.parse(lifecycle.write.mock.lastCall![1]);
        const workflow = operation === "connect" ? "imap" : "signup-verification";
        for (const app of ["calculator", "cost-tracker"])
          expect(report.results).toContainEqual({
            workflow: `${app}/${workflow}`,
            status: "failed",
            failureStage: operation === "connect" ? "assertion" : "inbox-receipt",
            durationMs: expect.any(Number),
            errorCategory: "failed",
          });
        expect(report.status).toBe("failed");
        const persisted = lifecycle.write.mock.lastCall![1];
        const emitted = [log, error, warn]
          .flatMap((output) => output.mock.calls.map((args) => args.join(" ")))
          .join("\n");
        expect(emitted).toContain(`FAILED calculator/${workflow}`);
        expect(JSON.parse(log.mock.calls.at(-1)![0])).toEqual(report);
        for (const output of [persisted, emitted]) {
          expect(output).not.toContain("SECRET");
          expect(output).not.toContain("private.test");
          expect(output).not.toContain("password=");
        }
      } finally {
        log.mockRestore();
        error.mockRestore();
        warn.mockRestore();
      }
    },
  );

  it.each([
    {
      kind: "secret",
      message: "signup failed: secret=r3-secret-7f3a9c",
      markers: ["r3-secret-7f3a9c", "secret="],
    },
    {
      kind: "url",
      message:
        "fetch failed for https://r3-url-leak.test/reset?token=r3-url-9b1c4d",
      markers: ["r3-url-leak.test", "r3-url-9b1c4d", "https://"],
    },
    {
      kind: "cookie",
      message:
        "auth failed: cookie session=r3-cookie-4d2e71; Set-Cookie: session=r3-cookie-4d2e71",
      markers: ["r3-cookie-4d2e71", "session="],
    },
    {
      kind: "credential",
      message:
        "sign-in failed for r3-credential-user.test with password=r3-cred-8a5f02",
      markers: ["r3-credential-user.test", "r3-cred-8a5f02", "password="],
    },
  ])(
    "never emits $kind error text through mail diagnostics",
    async ({ message, markers }) => {
      diagnostics.connect.mockResolvedValue(undefined);
      diagnostics.boundary.mockRejectedValue(new Error(message));
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(
          await verifyEmailWorkflows({
            handle: {
              runId: "a".repeat(32),
              databaseName: "owned",
              databaseUrl: "postgres://localhost/owned",
              baseDatabaseUrl: "postgres://localhost/postgres",
              baseDatabaseName: "postgres",
              serviceHost: "localhost",
              servicePort: "5432",
              createdAt: "2026-01-01T00:00:00Z",
            },
            servers: {
              calculatorBaseUrl: "http://127.0.0.1:1234",
              costTrackerBaseUrl: "http://127.0.0.1:1235",
              environment: {},
              stop: async () => {},
            },
            seed: {
              userId: "seed-user",
              organizationId: "seed-org",
              projectIds: [],
              partnerOrganizationId: "partner",
              secondPartnerOrganizationId: "second",
              thirdPartnerOrganizationId: "third",
              partnerProjectId: "partner-project",
              travelLegsEnsured: 0,
              scenarios: SEED_SCENARIOS,
            },
          }),
        ).toBe(false);
        const report = JSON.parse(lifecycle.write.mock.lastCall![1]);
        for (const app of ["calculator", "cost-tracker"])
          expect(report.results).toContainEqual({
            workflow: `${app}/signup-verification`,
            status: "failed",
            failureStage: "inbox-receipt",
            durationMs: expect.any(Number),
            errorCategory: "failed",
          });
        const persisted = lifecycle.write.mock.lastCall![1] as string;
        const emitted = [log, error, warn]
          .flatMap((output) => output.mock.calls.map((args) => args.join(" ")))
          .join("\n");
        for (const marker of markers) {
          expect(persisted).not.toContain(marker);
          expect(emitted).not.toContain(marker);
        }
        expect(persisted).not.toContain(message);
        expect(emitted).not.toContain(message);
        const diagLines = error.mock.calls
          .map((args) => args.join(" "))
          .filter((line) => line.includes("[mail-diag]"));
        expect(diagLines.length).toBeGreaterThan(0);
        for (const line of diagLines)
          expect(line).toMatch(
            /^\[mail-diag\] \S+ failed at (assertion|session|send-accept|inbox-receipt|link-exercise|acceptance) after \d+ms: (aborted|failed)$/,
          );
      } finally {
        log.mockRestore();
        error.mockRestore();
        warn.mockRestore();
      }
    },
  );
});
