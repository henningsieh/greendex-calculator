import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { SEED_USER } from "@greendex/auth/seed-user";
import * as schema from "@greendex/database/schema";
import { createTransporter } from "@greendex/email";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { and, eq, inArray, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  assertExistingIntegrationDatabase,
  existingIntegrationApp,
  type ExistingIntegrationContext,
  type ExistingIntegrationSeed,
  type IntegrationApp,
} from "../../../scripts/existing-integration-environment";
import {
  SEED_SCENARIOS,
  SEED_ORGANIZATION,
  SEED_SECOND_PARTNER_ORGANIZATION,
} from "../../calculator/scripts/seed";
import type { Router } from "../src/lib/orpc/router";
import { EmailInbox } from "./email-inbox";
import { validateMailboxEnvironment } from "./email-run-safety";

const recipient = "greendex-testing@apps.sieh.org";
const HTTP_TIMEOUT_MS = 60_000;
const MAX_WORKFLOW_RATE_LIMIT_RETRIES = 2;
const MAX_WORKFLOW_RATE_LIMIT_WAIT_MS = 30_000;
const DEFAULT_WORKFLOW_RATE_LIMIT_WAIT_MS = 11_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type FailureStage =
  | "assertion"
  | "session"
  | "send-accept"
  | "inbox-receipt"
  | "link-exercise"
  | "acceptance"
  | "cleanup";

type MailDiagErrorCategory = "aborted" | "failed";

type Result = {
  errorCategory?: MailDiagErrorCategory;
  failureStage?: FailureStage;
  workflow: string;
  status: "passed" | "failed" | "blocked";
  durationMs: number;
};

function classifyMailDiagError(error: unknown): MailDiagErrorCategory {
  if (error instanceof Error && error.name === "AbortError") return "aborted";
  return "failed";
}

/** Cookies and parsed response/link data never enter diagnostics or reports. */
export class HttpSession {
  private cookies = new Map<string, string>();
  readonly sessionTokens = new Set<string>();
  constructor(
    readonly base: string,
    private readonly signal?: AbortSignal,
  ) {}
  get cookie(): string {
    return [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
  }
  async request(path: string, body?: unknown): Promise<Response> {
    this.signal?.throwIfAborted();
    const url = new URL(path, this.base);
    if (url.origin !== this.base)
      throw new Error("Refusing cross-origin workflow request.");
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(url, {
        method: body === undefined ? "GET" : "POST",
        redirect: "manual",
        signal: AbortSignal.any([
          ...(this.signal ? [this.signal] : []),
          AbortSignal.timeout(HTTP_TIMEOUT_MS),
        ]),
        headers: {
          origin: this.base,
          cookie: this.cookie,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.status !== 429 || attempt >= MAX_WORKFLOW_RATE_LIMIT_RETRIES) {
        for (const header of response.headers.getSetCookie()) {
          const pair = header.split(";", 1)[0];
          const split = pair.indexOf("=");
          this.cookies.set(pair.slice(0, split), pair.slice(split + 1));
        }
        return response;
      }
      await response.arrayBuffer().catch(() => undefined);
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? Math.min(retryAfterSeconds * 1000, MAX_WORKFLOW_RATE_LIMIT_WAIT_MS)
          : DEFAULT_WORKFLOW_RATE_LIMIT_WAIT_MS;
      await delay(waitMs, undefined, { signal: this.signal });
    }
  }
  auth(
    path: "organization/list",
    body?: unknown,
  ): Promise<Record<string, unknown>[]>;
  auth(path: string, body?: unknown): Promise<Record<string, unknown>>;
  async auth(
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown> | Record<string, unknown>[]> {
    const response = await this.request(`/api/auth/${path}`, body);
    if (!response.ok) throw new Error("Supported auth request failed.");
    const payload: unknown = await response.json();
    if (path === "organization/list") {
      if (
        !Array.isArray(payload) ||
        !payload.every(
          (organization) =>
            isRecord(organization) && typeof organization.id === "string",
        )
      )
        throw new Error("Supported auth response was invalid.");
      return payload;
    }
    if (!isRecord(payload))
      throw new Error("Supported auth response was invalid.");
    if (path === "sign-in/email" && typeof payload.token === "string")
      this.sessionTokens.add(payload.token);
    if (isRecord(payload.session) && typeof payload.session.token === "string")
      this.sessionTokens.add(payload.session.token);
    return payload;
  }
  rpc(): RouterClient<Router> {
    return createORPCClient(
      new RPCLink({
        origin: this.base,
        url: "/api/rpc",
        headers: () => ({ origin: this.base, cookie: this.cookie }),
        fetch: (input, init) => {
          this.signal?.throwIfAborted();
          return fetch(input, {
            ...init,
            signal: AbortSignal.any([
              ...(this.signal ? [this.signal] : []),
              ...(init.signal ? [init.signal] : []),
              AbortSignal.timeout(HTTP_TIMEOUT_MS),
            ]),
          });
        },
      }),
    );
  }
  async signIn(email: string, password: string): Promise<void> {
    await this.auth("sign-in/email", { email, password });
    const response = await this.auth("get-session");
    const user = response.user;
    if (!isRecord(user) || user.email !== email || user.emailVerified !== true)
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

function reportBlockedWorkflows(results: Result[], apps: readonly IntegrationApp[]): void {
  for (const app of apps) {
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

export interface ExistingEmailRun {
  context: ExistingIntegrationContext;
  apps?: readonly IntegrationApp[];
}

export async function resolveExistingIntegrationSeed(databaseUrl: string): Promise<ExistingIntegrationSeed> {
  assertExistingIntegrationDatabase(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl, max: 1,
    connectionTimeoutMillis: 10_000, query_timeout: 10_000, statement_timeout: 10_000 });
  try {
    const result = await pool.query<{ id: string; slug: string }>(
      "SELECT id, slug FROM organization WHERE slug = ANY($1::text[])",
      [[SEED_ORGANIZATION.slug, SEED_SECOND_PARTNER_ORGANIZATION.slug]],
    );
    const organizationId = result.rows.find(({ slug }) => slug === SEED_ORGANIZATION.slug)?.id;
    const secondPartnerOrganizationId = result.rows.find(({ slug }) => slug === SEED_SECOND_PARTNER_ORGANIZATION.slug)?.id;
    if (!organizationId || !secondPartnerOrganizationId)
      throw new Error("Required existing seed Organizations are missing; no seeding will be performed.");
    return { organizationId, secondPartnerOrganizationId };
  } finally {
    await pool.end();
  }
}

export async function verifyEmailWorkflows(
  existing: ExistingEmailRun,
  signal?: AbortSignal,
): Promise<boolean> {
  signal?.throwIfAborted();
  const apps = existing.apps ?? ["calculator", "cost-tracker"] as const;
  const results: Result[] = [];
  const run = { runId: existing.context.correlationId, databaseUrl: existing.context.databaseUrl };
  const bases: Partial<Record<IntegrationApp, string>> = {};
  let pool: Pool | undefined;
  const inboxes: { app: string; inbox: EmailInbox }[] = [];
  const startedAt = Date.now();
  let failureStage: FailureStage = "assertion";
  const check = async (
    workflow: string,
    action: () => Promise<void>,
  ): Promise<boolean> => {
    signal?.throwIfAborted();
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
    } catch (error) {
      const durationMs = Date.now() - started;
      const errorCategory =
        signal?.aborted === true
          ? ("aborted" as const)
          : classifyMailDiagError(error);
      console.error(
        `[mail-diag] ${workflow} failed at ${failureStage} after ${durationMs}ms: ${errorCategory}`,
      );
      results.push({
        workflow,
        failureStage,
        status: "failed",
        durationMs,
        errorCategory,
      });
      return false;
    }
  };
  try {
    const environments: Partial<Record<IntegrationApp, Record<string, string>>> = {};
    if (!apps.length || new Set(apps).size !== apps.length)
      throw new Error("Required email application inventory is empty or duplicated.");
    for (const app of apps) {
      const target = existing.context.apps[app];
      if (!target) throw new Error("Existing email application is unavailable.");
      const environment = { ...target.environment, DELETE_TESTMAILS_DURING_TESTRUN: "false" };
      if (existingIntegrationApp(environment).baseUrl !== target.baseUrl)
        throw new Error("Existing email application URL mismatch.");
      bases[app] = target.baseUrl;
      validateMailboxEnvironment(environment);
      environments[app] = environment;
    }
    assertExistingIntegrationDatabase(existing.context.databaseUrl);
    const seed = existing.context.seed;
    pool = new Pool({
      connectionString: run.databaseUrl,
      max: 1,
      connectionTimeoutMillis: 10_000,
      query_timeout: 30_000,
      statement_timeout: 30_000,
    });
    const db = drizzle(pool, { schema });
    results.push({
      workflow: "existing-environment-read-only-seed",
      status: "passed",
      durationMs: Date.now() - startedAt,
    });
    for (const app of apps) {
      signal?.throwIfAborted();
      const base = bases[app];
      const environment = environments[app];
      if (!base || !environment) throw new Error("Required email application configuration is missing.");
      const inbox = new EmailInbox(environment);
      inboxes.push({ app, inbox });
      if (!(await check(`${app}/imap`, () => inbox.connect()))) continue;
      await check(`${app}/invalid-smtp-credentials`, () =>
        invalidCredentialCheck(environment),
      );
      const name = `${run.runId}-${app}`;
      const initialPassword = `Test-${randomUUID()}!`;
      let userId: string | undefined;
      const sessions: HttpSession[] = [];
      const newSession = () => {
        const session = new HttpSession(base, signal);
        sessions.push(session);
        return session;
      };
      const organizationInvitationIds: string[] = [];
      const participantInvitationIds: string[] = [];
      let recipientWasClean = false;
      const verificationIdsBefore = new Set<string>();
      const account = newSession();
      try {
      {
        const consistent = await check(`${app}/database-consistency`, async () => {
          const owner = newSession();
          await owner.signIn(SEED_USER.email, SEED_USER.password);
          const identity = await owner.auth("get-session");
          if (!isRecord(identity.session) || typeof identity.session.id !== "string" || !isRecord(identity.user))
            throw new Error("Existing application session identity is unavailable.");
          const observed = await db.query.session.findFirst({ where: eq(schema.session.id, identity.session.id) });
          if (!observed || observed.userId !== identity.user.id)
            throw new Error("Existing application does not observe the shared development database.");
        });
        if (!consistent) continue;
        const clean = await check(`${app}/fixture-prerequisites`, async () => {
          const identities = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, recipient));
          const invitations = await db.select({ id: schema.invitation.id }).from(schema.invitation).where(eq(schema.invitation.email, recipient));
          const entries = await db.select({ id: schema.participantEntryTokensTable.id }).from(schema.participantEntryTokensTable).where(eq(schema.participantEntryTokensTable.email, recipient));
          if (identities.length || invitations.length || entries.length)
            throw new Error("Dedicated workflow recipient has existing records; refusing to alter them.");
          const verifications = await db.select({ id: schema.verification.id }).from(schema.verification).where(or(eq(schema.verification.identifier, recipient), like(schema.verification.value, `%${recipient}%`)));
          for (const { id } of verifications) verificationIdsBefore.add(id);
          recipientWasClean = true;
        });
        if (!clean) continue;
      }
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
          callbackURL: `${base}/?run=${run.runId}&workflow=signup`,
        });
        const createdUser = response.user;
        if (!isRecord(createdUser) || typeof createdUser.id !== "string")
          throw new Error("Signup did not create a User.");
        userId = createdUser.id;
        failureStage = "inbox-receipt";
        const link = await inbox.deliveredLink(
          boundary,
          "Verify Your Email Address",
          base,
          "/api/auth/verify-email",
          (_, html) => html.includes(name),
          signal,
        );
        failureStage = "link-exercise";
        const exercised = await account.request(link);
        if (exercised.status < 200 || exercised.status >= 400)
          throw new Error("Delivered verification link failed.");
        failureStage = "session";
        await account.signIn(recipient, initialPassword);
      });
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
          const owner = newSession();
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
          organizationInvitationIds.push(invitationId);
          failureStage = "inbox-receipt";
          const link = await inbox.deliveredLink(
            boundary,
            `You're invited to join ${SEED_ORGANIZATION.name}`,
            base,
            "/accept-invitation/",
            (url) => url.pathname.split("/").at(-1) === invitationId,
            signal,
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
          if (!memberships.some((org) => org.id === seed.organizationId))
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
            redirectTo: `${base}/reset-password?run=${run.runId}&workflow=reset`,
          });
          failureStage = "inbox-receipt";
          const link = await inbox.deliveredLink(
            boundary,
            "Reset Your Password",
            base,
            "/api/auth/reset-password/",
            (_, html) => html.includes(name),
            signal,
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
          await newSession().signIn(recipient, nextPassword);
          const oldSignIn = await newSession().request(
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
            const fresh = newSession();
            failureStage = "inbox-receipt";
            const boundary = await inbox.boundary();
            failureStage = "send-accept";
            await fresh.auth("sign-in/magic-link", {
              email: recipient,
              callbackURL: `${base}/?run=${run.runId}&workflow=magic`,
            });
            failureStage = "inbox-receipt";
            const link = await inbox.deliveredLink(
              boundary,
              "Sign in to your account",
              base,
              "/api/auth/magic-link/verify",
              (url) =>
                (url.searchParams.get("callbackURL") || "").includes(
                  run.runId,
                ),
              signal,
            );
            failureStage = "link-exercise";
            const response = await fresh.request(link);
            if (response.status >= 400) throw new Error("Magic link failed.");
            failureStage = "assertion";
            const session = await fresh.auth("get-session");
            if (!isRecord(session.user) || session.user.email !== recipient)
              throw new Error("Magic link did not sign in.");
          });
        } else {
          await check(`${app}/participant-invitation`, async () => {
            const owner = newSession();
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
            participantInvitationIds.push(issued.invitationId);
            if (issued.delivery !== "sent")
              throw new Error("Participant invitation was not sent.");
            failureStage = "inbox-receipt";
            const link = await inbox.deliveredLink(
              boundary,
              "Your Participant Invitation",
              base,
              "/participant-invitations/",
              (url) => url.pathname.split("/").at(-1) === issued.invitationId,
              signal,
            );
            const url = new URL(link);
            const invitationId = url.pathname.split("/").at(-1)!;
            const secret = url.searchParams.get("secret");
            if (!secret)
              throw new Error("Delivered participant invitation has no secret.");
            const joiner = newSession();
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
        const clean = async (action: () => Promise<void>) => {
          try { await action(); }
          catch {
            results.push({ workflow: `${app}/fixture-cleanup`, status: "failed", failureStage: "cleanup", durationMs: 0 });
          }
        };
        {
          for (const session of sessions) {
            if (!session.cookie) continue;
            await clean(async () => {
              const response = await fetch(`${base}/api/auth/sign-out`, {
                method: "POST", redirect: "manual",
                headers: { origin: base, cookie: session.cookie, "content-type": "application/json" },
                body: "{}", signal: AbortSignal.timeout(10_000),
              });
              if (!response.ok) throw new Error("Workflow session cleanup failed.");
            });
          }
          await clean(async () => {
            if (!userId) {
              const created = await db.query.user.findFirst({
                where: and(eq(schema.user.email, recipient), eq(schema.user.name, name)),
              });
              userId = created?.id;
            }
            if (recipientWasClean) {
              const invitations = await db.select({ id: schema.invitation.id }).from(schema.invitation).where(and(eq(schema.invitation.email, recipient), eq(schema.invitation.organizationId, seed.organizationId)));
              organizationInvitationIds.push(...invitations.map(({ id }) => id));
              const entries = await db.select({ id: schema.participantEntryTokensTable.id }).from(schema.participantEntryTokensTable).where(eq(schema.participantEntryTokensTable.email, recipient));
              participantInvitationIds.push(...entries.map(({ id }) => id));
            }
          });
          if (userId) await clean(async () => {
            const verifications = await db.select().from(schema.verification).where(or(eq(schema.verification.value, userId!), eq(schema.verification.identifier, recipient), like(schema.verification.value, `%${recipient}%`)));
            const owned = verifications.filter(({ id, value, identifier }) => {
              if (verificationIdsBefore.has(id)) return false;
              if (value === userId || identifier === recipient) return true;
              try {
                const parsed: unknown = JSON.parse(value);
                return isRecord(parsed) && parsed.email === recipient;
              } catch { return false; }
            });
            if (owned.length) await db.delete(schema.verification).where(inArray(schema.verification.id, owned.map(({ id }) => id)));
          });
        }
        const tokens = sessions.flatMap((session) => [...session.sessionTokens]);
        if (tokens.length) await clean(async () => { await db.delete(schema.session).where(inArray(schema.session.token, tokens)); });
        if (organizationInvitationIds.length) await clean(async () => {
          await db.delete(schema.invitation).where(and(inArray(schema.invitation.id, organizationInvitationIds), eq(schema.invitation.email, recipient)));
        });
        if (participantInvitationIds.length) await clean(async () => {
          await db.delete(schema.participantEntryTokensTable).where(and(inArray(schema.participantEntryTokensTable.id, participantInvitationIds), eq(schema.participantEntryTokensTable.email, recipient)));
        });
        if (userId) await clean(async () => {
          await db.delete(schema.projectParticipantsTable).where(eq(schema.projectParticipantsTable.userId, userId!));
          await db.delete(schema.user).where(and(eq(schema.user.id, userId!), eq(schema.user.email, recipient)));
        });
      }
    }
  } catch {
    results.push({
      workflow: "required-prerequisites",
      status: "blocked",
      durationMs: Date.now() - startedAt,
    });
  } finally {
    for (const { app, inbox } of inboxes) {
      try { await inbox.cleanup(); }
      catch { results.push({ workflow: `${app}/mail-cleanup`, status: "failed", durationMs: 0 }); }
    }
    try { await pool?.end(); }
    catch { results.push({ workflow: "pool-cleanup", status: "failed", durationMs: 0 }); }
  }
  reportBlockedWorkflows(results, apps);
  const passed = results.length > 0 && results.every((result) => result.status === "passed");
  console.log(`Real email workflows ${passed ? "PASSED" : "FAILED"} (${Date.now() - startedAt}ms). Mail retained. Existing servers and database retained.`);
  for (const result of results)
    console.log(`${result.status.toUpperCase()} ${result.workflow} (${result.durationMs}ms)`);
  return passed;
}
