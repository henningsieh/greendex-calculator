/* eslint-disable import/no-relative-parent-imports -- Cross-app test orchestration reuses the canonical seed and owned lifecycle, not runtime app imports. */
import { execFile, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { SEED_USER } from "@greendex/auth/seed-user";
import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import * as schema from "@greendex/database/schema";
import { createTransporter } from "@greendex/email";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  readLocalEnvironment,
  startManagedAppServers,
  type ManagedAppServers,
} from "../../../scripts/managed-app-servers";
import {
  seedDatabase,
  SEED_SCENARIOS,
  SEED_ORGANIZATION,
} from "../../calculator/scripts/seed";
import {
  createIsolatedRunDatabase,
  disposeIsolatedRunDatabase,
  IsolatedRunCreationError,
  type IsolatedRunHandle,
} from "../../calculator/src/__tests__/helpers/isolated-run-database";
import type { Router } from "../src/lib/orpc/router";
import { EmailInbox } from "./email-inbox";
import { validateMailboxEnvironment } from "./email-run-safety";

const root = resolve(import.meta.dirname, "../../..");
const execute = promisify(execFile);
const recipient = "greendex-testing@apps.sieh.org";
const HTTP_TIMEOUT_MS = 60_000;

type FailureStage =
  | "assertion"
  | "session"
  | "send-accept"
  | "inbox-receipt"
  | "link-exercise"
  | "acceptance";

type Result = {
  failureStage?: FailureStage;
  workflow: string;
  status: "passed" | "failed" | "blocked";
  durationMs: number;
};

/** Cookies and parsed response/link data never enter diagnostics or reports. */
class HttpSession {
  private cookies = new Map<string, string>();
  constructor(readonly base: string) {}
  get cookie(): string {
    return [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
  }
  async request(path: string, body?: unknown): Promise<Response> {
    const url = new URL(path, this.base);
    if (url.origin !== this.base)
      throw new Error("Refusing cross-origin workflow request.");
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      headers: {
        origin: this.base,
        cookie: this.cookie,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(";", 1)[0];
      const split = pair.indexOf("=");
      this.cookies.set(pair.slice(0, split), pair.slice(split + 1));
    }
    return response;
  }
  async auth(path: string, body?: unknown): Promise<Record<string, unknown>> {
    const response = await this.request(`/api/auth/${path}`, body);
    if (!response.ok) throw new Error("Supported auth request failed.");
    return (await response.json()) as Record<string, unknown>;
  }
  rpc(): RouterClient<Router> {
    return createORPCClient(
      new RPCLink({
        origin: this.base,
        url: "/api/rpc",
        headers: () => ({ origin: this.base, cookie: this.cookie }),
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) }),
      }),
    );
  }
  async signIn(email: string, password: string): Promise<void> {
    await this.auth("sign-in/email", { email, password });
    const response = await this.auth("get-session");
    const user = response.user as
      | { email?: string; emailVerified?: boolean }
      | undefined;
    if (user?.email !== email || !user.emailVerified)
      throw new Error("Verified sign-in was not established.");
  }
}

async function invalidCredentialCheck(
  environment: Record<string, string>,
): Promise<void> {
  const transporter = createTransporter({
    host: environment.SMTP_HOST,
    port: Number(environment.SMTP_PORT),
    secure: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    auth: { user: environment.SMTP_USERNAME, pass: `invalid-${randomUUID()}` },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("negative verification timed out")),
          20_000,
        );
      }),
    ]);
    throw new Error("Invalid SMTP credentials were unexpectedly accepted.");
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "EAUTH"
    )
      throw new Error(
        "Controlled invalid credential check did not produce an authentication rejection.",
      );
  } finally {
    clearTimeout(timer);
    transporter.close();
  }
}

type Cleanup = {
  servers: string;
  database: string;
  mail: { app: string; retained: number; deleted: number }[];
};

async function cleanupRun(
  inboxes: { app: string; inbox: EmailInbox }[],
  servers: ManagedAppServers | undefined,
  pool: Pool | undefined,
  handle: IsolatedRunHandle | undefined,
  cleanup: Cleanup,
  results: Result[],
): Promise<void> {
  for (const { app, inbox } of inboxes) {
    try {
      cleanup.mail.push({ app, ...(await inbox.cleanup()) });
    } catch {
      results.push({
        workflow: `${app}/mail-cleanup`,
        status: "failed",
        durationMs: 0,
      });
    }
  }
  if (servers) {
    try {
      await servers.stop();
      cleanup.servers = "stopped";
    } catch {
      cleanup.servers = "failed";
    }
  }
  if (pool) {
    try {
      await pool.end();
    } catch {
      results.push({ workflow: "pool-cleanup", status: "failed", durationMs: 0 });
    }
  }
  if (handle) {
    try {
      await disposeIsolatedRunDatabase(handle);
      cleanup.database = "disposed";
    } catch {
      cleanup.database = "failed";
    }
  }
}

function reportBlockedWorkflows(results: Result[]): void {
  for (const app of ["calculator", "cost-tracker"] as const) {
    for (const workflow of [
      "imap",
      "invalid-smtp-credentials",
      "signup-verification",
      "organization-invitation",
      "password-reset",
      app === "calculator" ? "magic-link" : "participant-invitation",
    ]) {
      const name = `${app}/${workflow}`;
      if (!results.some((result) => result.workflow === name))
        results.push({ workflow: name, status: "blocked", durationMs: 0 });
    }
  }
}

export interface InjectedEmailRun {
  handle: IsolatedRunHandle;
  servers: ManagedAppServers;
  seed: Awaited<ReturnType<typeof seedDatabase>>;
}

export async function verifyEmailWorkflows(
  injected?: InjectedEmailRun,
): Promise<boolean> {
  const results: Result[] = [];
  const cleanup = {
    servers: "not-started",
    database: "not-created",
    mail: [] as { app: string; retained: number; deleted: number }[],
  };
  let handle: IsolatedRunHandle | undefined;
  let servers: ManagedAppServers | undefined;
  let pool: Pool | undefined;
  const inboxes: { app: string; inbox: EmailInbox }[] = [];
  const startedAt = Date.now();
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
  }).trim();
  // Sequential workflows expose only a finite static stage, never caught error data.
  let failureStage: FailureStage = "assertion";
  const check = async (
    workflow: string,
    action: () => Promise<void>,
  ): Promise<boolean> => {
    const started = Date.now();
    failureStage = "assertion";
    try {
      await action();
      results.push({
        workflow,
        status: "passed",
        durationMs: Date.now() - started,
      });
      return true;
    } catch {
      results.push({
        workflow,
        failureStage,
        status: "failed",
        durationMs: Date.now() - started,
      });
      return false;
    }
  };
  try {
    const environments = {
      calculator: await readLocalEnvironment(
        resolve(root, "apps/calculator/.env"),
      ),
      "cost-tracker": await readLocalEnvironment(
        resolve(root, "apps/cost-tracker/.env"),
      ),
    };
    for (const environment of Object.values(environments)) {
      // The sole runtime override is the explicit run-only retention policy.
      if (process.env.DELETE_TESTMAILS_DURING_TESTRUN !== undefined)
        environment.DELETE_TESTMAILS_DURING_TESTRUN =
          process.env.DELETE_TESTMAILS_DURING_TESTRUN;
      validateMailboxEnvironment(environment);
    }
    let seed: Awaited<ReturnType<typeof seedDatabase>>;
    if (injected) {
      handle = injected.handle;
      servers = injected.servers;
      seed = injected.seed;
      cleanup.database = "root-owned";
      cleanup.servers = "root-owned";
    } else {
      const databaseEnvironment = await readLocalEnvironment(
        resolve(root, "packages/database/.env"),
      );
      if (!databaseEnvironment.DATABASE_URL)
        throw new Error("Missing database configuration.");
      handle = await createIsolatedRunDatabase({
        baseDatabaseUrl: databaseEnvironment.DATABASE_URL,
        prefix: "email_check",
      });
      cleanup.database = "pending";
      await execute("pnpm", ["run", "db:migrate"], {
        cwd: resolve(root, "packages/database"),
        env: { ...process.env, DATABASE_URL: handle.databaseUrl },
        timeout: 120_000,
      });
      pool = new Pool({
        connectionString: handle.databaseUrl,
        max: 1,
        connectionTimeoutMillis: 10_000,
        statement_timeout: 30_000,
      });
      const db = drizzle(pool, { schema });
      // Seed output includes private dataset details; do not relay it to reports.
      const originalLog = console.log;
      try {
        console.log = () => {};
        seed = await seedDatabase(db);
      } finally {
        console.log = originalLog;
      }
      servers = await startManagedAppServers(
        root,
        { runId: handle.runId, databaseUrl: handle.databaseUrl },
        environments,
      );
      cleanup.servers = "pending";
    }
    if (!pool)
      pool = new Pool({
        connectionString: handle.databaseUrl,
        max: 1,
        connectionTimeoutMillis: 10_000,
        statement_timeout: 30_000,
      });
    const db = drizzle(pool, { schema });
    results.push({
      workflow: "isolated-migrated-seeded-managed-servers",
      status: "passed",
      durationMs: Date.now() - startedAt,
    });
    for (const app of ["calculator", "cost-tracker"] as const) {
      const base =
        app === "calculator"
          ? servers.calculatorBaseUrl
          : servers.costTrackerBaseUrl;
      const inbox = new EmailInbox(environments[app]);
      inboxes.push({ app, inbox });
      if (!(await check(`${app}/imap`, () => inbox.connect()))) continue;
      await check(`${app}/invalid-smtp-credentials`, () =>
        invalidCredentialCheck(environments[app]),
      );
      const name = `${handle.runId}-${app}`;
      const initialPassword = `Test-${randomUUID()}!`;
      let userId: string | undefined;
      const account = new HttpSession(base);
      const verified = await check(`${app}/signup-verification`, async () => {
        const existing = await db
          .select({ id: schema.user.id })
          .from(schema.user)
          .where(eq(schema.user.email, recipient));
        if (existing.length)
          throw new Error("Run recipient identity was not clean.");
        failureStage = "inbox-receipt";
        const boundary = await inbox.boundary();
        failureStage = "send-accept";
        const response = await account.auth("sign-up/email", {
          name,
          email: recipient,
          password: initialPassword,
          callbackURL: `${base}/?run=${handle!.runId}&workflow=signup`,
        });
        const createdUser = response.user as { id?: string } | undefined;
        if (!createdUser?.id) throw new Error("Signup did not create a User.");
        userId = createdUser.id;
        failureStage = "inbox-receipt";
        const link = await inbox.deliveredLink(
          boundary,
          "Verify Your Email Address",
          base,
          "/api/auth/verify-email",
          (_, html) => html.includes(name),
        );
        failureStage = "link-exercise";
        const exercised = await account.request(link);
        if (exercised.status < 200 || exercised.status >= 400)
          throw new Error("Delivered verification link failed.");
        failureStage = "session";
        await account.signIn(recipient, initialPassword);
      });
      try {
        if (!verified) {
          for (const workflow of [
            "organization-invitation",
            "password-reset",
            app === "calculator" ? "magic-link" : "participant-invitation",
          ])
            results.push({
              workflow: `${app}/${workflow}`,
              status: "blocked",
              durationMs: 0,
            });
          continue;
        }
        await check(`${app}/organization-invitation`, async () => {
          const owner = new HttpSession(base);
          failureStage = "session";
          await owner.signIn(SEED_USER.email, SEED_USER.password);
          await owner.auth("organization/set-active", {
            organizationId: seed.organizationId,
          });
          failureStage = "inbox-receipt";
          const boundary = await inbox.boundary();
          failureStage = "send-accept";
          const invitationId =
            app === "calculator"
              ? (
                  await owner.auth("organization/invite-member", {
                    organizationId: seed.organizationId,
                    email: recipient,
                    role: ORGANIZATION_ROLES.OrganizationAdmin,
                  })
                ).id
              : (
                  await owner.rpc().organizations.inviteMember({
                    email: recipient,
                    role: ORGANIZATION_ROLES.OrganizationAdmin,
                  })
                ).invitationId;
          if (typeof invitationId !== "string")
            throw new Error("Invitation was not issued.");
          failureStage = "inbox-receipt";
          const link = await inbox.deliveredLink(
            boundary,
            `You're invited to join ${SEED_ORGANIZATION.name}`,
            base,
            "/accept-invitation/",
            (url) => url.pathname.split("/").at(-1) === invitationId,
          );
          const deliveredId = new URL(link).pathname.split("/").at(-1)!;
          failureStage = "link-exercise";
          const page = await account.request(link);
          if (page.status >= 400)
            throw new Error("Delivered invitation page failed.");
          failureStage = "acceptance";
          if (app === "calculator")
            await account.auth("organization/accept-invitation", {
              invitationId: deliveredId,
            });
          else
            await account
              .rpc()
              .organizations.acceptInvitation({ invitationId: deliveredId });
          failureStage = "assertion";
          const memberships = await account.auth("organization/list");
          if (
            !Array.isArray(memberships) ||
            !memberships.some(
              (org: { id: string }) => org.id === seed.organizationId,
            )
          )
            throw new Error(
              "Invitation acceptance did not establish Membership.",
            );
        });
        let currentPassword = initialPassword;
        await check(`${app}/password-reset`, async () => {
          failureStage = "inbox-receipt";
          const boundary = await inbox.boundary();
          failureStage = "send-accept";
          await account.auth("request-password-reset", {
            email: recipient,
            redirectTo: `${base}/reset-password?run=${handle!.runId}&workflow=reset`,
          });
          failureStage = "inbox-receipt";
          const link = await inbox.deliveredLink(
            boundary,
            "Reset Your Password",
            base,
            "/api/auth/reset-password/",
            (_, html) => html.includes(name),
          );
          failureStage = "link-exercise";
          const response = await account.request(link);
          const location = response.headers.get("location");
          if (response.status < 300 || response.status >= 400 || !location)
            throw new Error("Reset link did not produce a supported redirect.");
          const redirect = new URL(location, base);
          if (
            redirect.origin !== base ||
            !redirect.searchParams.get("token") ||
            redirect.searchParams.has("error")
          )
            throw new Error("Reset link was not valid.");
          const nextPassword = `Reset-${randomUUID()}!`;
          failureStage = "acceptance";
          await account.auth("reset-password", {
            token: redirect.searchParams.get("token"),
            newPassword: nextPassword,
          });
          failureStage = "assertion";
          await new HttpSession(base).signIn(recipient, nextPassword);
          const oldSignIn = await new HttpSession(base).request(
            "/api/auth/sign-in/email",
            { email: recipient, password: initialPassword },
          );
          if (oldSignIn.status !== 401)
            throw new Error(
              "Old password was not rejected as invalid credentials.",
            );
          currentPassword = nextPassword;
        });
        if (app === "calculator") {
          await check(`${app}/magic-link`, async () => {
            const fresh = new HttpSession(base);
            failureStage = "inbox-receipt";
            const boundary = await inbox.boundary();
            failureStage = "send-accept";
            await fresh.auth("sign-in/magic-link", {
              email: recipient,
              callbackURL: `${base}/?run=${handle!.runId}&workflow=magic`,
            });
            failureStage = "inbox-receipt";
            const link = await inbox.deliveredLink(
              boundary,
              "Sign in to your account",
              base,
              "/api/auth/magic-link/verify",
              (url) =>
                (url.searchParams.get("callbackURL") || "").includes(
                  handle!.runId,
                ),
            );
            failureStage = "link-exercise";
            const response = await fresh.request(link);
            if (response.status >= 400) throw new Error("Magic link failed.");
            failureStage = "assertion";
            const session = await fresh.auth("get-session");
            if (
              (session.user as { email?: string } | undefined)?.email !==
              recipient
            )
              throw new Error("Magic link did not sign in.");
          });
        } else {
          await check(`${app}/participant-invitation`, async () => {
            const owner = new HttpSession(base);
            failureStage = "session";
            await owner.signIn(SEED_USER.email, SEED_USER.password);
            await owner.auth("organization/set-active", {
              organizationId: seed.secondPartnerOrganizationId,
            });
            failureStage = "assertion";
            const [partnership] = await db
              .select({ id: schema.projectPartnerOrganizationsTable.id })
              .from(schema.projectPartnerOrganizationsTable)
              .innerJoin(
                schema.projectsTable,
                eq(
                  schema.projectsTable.id,
                  schema.projectPartnerOrganizationsTable.projectId,
                ),
              )
              .where(
                and(
                  eq(
                    schema.projectsTable.name,
                    SEED_SCENARIOS.participantInvitationProject.name,
                  ),
                  eq(
                    schema.projectPartnerOrganizationsTable.organizationId,
                    seed.secondPartnerOrganizationId,
                  ),
                ),
              );
            if (!partnership)
              throw new Error(
                "Canonical participant-invitation Partnership missing.",
              );
            failureStage = "inbox-receipt";
            const boundary = await inbox.boundary();
            failureStage = "send-accept";
            const issued = await owner
              .rpc()
              .participantOnboarding.issueInvitation({
                partnershipId: partnership.id,
                email: recipient,
              });
            if (issued.delivery !== "sent")
              throw new Error("Participant invitation was not sent.");
            failureStage = "inbox-receipt";
            const link = await inbox.deliveredLink(
              boundary,
              "Your Participant Invitation",
              base,
              "/participant-invitations/",
              (url) => url.pathname.split("/").at(-1) === issued.invitationId,
            );
            const url = new URL(link);
            const invitationId = url.pathname.split("/").at(-1)!;
            const secret = url.searchParams.get("secret");
            if (!secret)
              throw new Error("Delivered participant invitation has no secret.");
            const joiner = new HttpSession(base);
            failureStage = "session";
            await joiner.signIn(recipient, currentPassword);
            failureStage = "link-exercise";
            const page = await joiner.request(link);
            if (page.status >= 400)
              throw new Error("Delivered Participant Invitation page failed.");
            failureStage = "acceptance";
            const joined = await joiner.rpc().participantOnboarding.join({
              source: { kind: "invitation", invitationId, secret },
              profile: { fullName: name, country: "DE" },
              agreement: { accepted: true },
            });
            if (!joined.participationId)
              throw new Error(
                "Delivered Participant Invitation was not consumed.",
              );
            failureStage = "assertion";
            const mine = await joiner
              .rpc()
              .participantOnboarding.listMyProjects();
            if (
              !mine.some(
                (participation) =>
                  participation.participationId === joined.participationId,
              )
            )
              throw new Error(
                "Joined Project Participation is not visible through the supported API.",
              );
          });
        }
      } finally {
        // Approved interference cleanup only: run-created mailbox User, never seed actors.
        if (userId) {
          await db
            .delete(schema.projectParticipantsTable)
            .where(eq(schema.projectParticipantsTable.userId, userId));
          await db
            .delete(schema.user)
            .where(
              and(eq(schema.user.id, userId), eq(schema.user.email, recipient)),
            );
        }
      }
    }
  } catch (error) {
    if (error instanceof IsolatedRunCreationError) {
      handle = error.handle;
      cleanup.database = error.rollback;
    }
    results.push({
      workflow: "required-prerequisites",
      status: "blocked",
      durationMs: Date.now() - startedAt,
    });
  } finally {
    await cleanupRun(
      inboxes,
      injected ? undefined : servers,
      pool,
      injected ? undefined : handle,
      cleanup,
      results,
    );
  }
  reportBlockedWorkflows(results);
  const passed =
    results.every((result) => result.status === "passed") &&
    cleanup.servers === (injected ? "root-owned" : "stopped") &&
    cleanup.database === (injected ? "root-owned" : "disposed");
  const report = {
    suite: "real-email-workflows",
    commit,
    runId: handle?.runId ?? null,
    seedVersion: createHash("sha256")
      .update(await readFile(resolve(root, "apps/calculator/scripts/seed.ts")))
      .digest("hex"),
    seedRulesVersion: TRAVEL_FUNDING_RULES.version,
    workingTreeDirty:
      execFileSync("git", ["status", "--porcelain"], {
        cwd: root,
        encoding: "utf8",
        timeout: 10_000,
      }).trim().length > 0,
    status: passed ? "passed" : "failed",
    durationMs: Date.now() - startedAt,
    results,
    cleanup,
  };
  console.log(`Real email workflows: ${report.status.toUpperCase()}`);
  for (const result of results)
    console.log(
      `${result.status.toUpperCase()} ${result.workflow}${result.failureStage ? ` (${result.failureStage})` : ""}`,
    );
  console.log(JSON.stringify(report));
  // Only the sanitized schema above is persisted; never subprocess output or errors.
  await mkdir(resolve(root, ".turbo/email-workflows"), { recursive: true });
  await writeFile(
    resolve(root, `.turbo/email-workflows/${handle?.runId ?? randomUUID()}.json`),
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  return passed;
}
