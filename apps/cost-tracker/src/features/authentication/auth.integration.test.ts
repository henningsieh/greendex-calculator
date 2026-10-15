// @vitest-environment node

import { randomUUID } from "node:crypto";

import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import {
  organization,
  session as sessionsTable,
  user,
  verification,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq, like } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const emailMocks = vi.hoisted(() => ({
  sendEmailVerificationEmail: vi
    .fn<(input: { url: string }) => Promise<void>>()
    .mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email", () => ({ emailSender: emailMocks }));
vi.mock("server-only", () => ({}));

import { env } from "@/env";
import { auth } from "@/lib/auth";
import { router } from "@/lib/orpc/router";

const createdEmails: string[] = [];
const createdOrganizationIds: string[] = [];
const caseSessionTokens: string[] = [];

function uniqueEmail() {
  const email = `cost-tracker-auth-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

afterEach(async () => {
  for (const token of caseSessionTokens.splice(0)) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  for (const email of createdEmails.splice(0)) {
    await db.delete(user).where(eq(user.email, email));
    await db
      .delete(verification)
      .where(like(verification.identifier, `%${email}%`));
  }
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  vi.clearAllMocks();
});

describe("Cost Tracker Better Auth", () => {
  it("signs up with email verification and signs in only after verification", async () => {
    const email = uniqueEmail();
    const password = "correct-horse-battery-staple";

    const signUp = await auth.api.signUpEmail({
      body: { email, name: "Cost Tracker User", password },
    });

    expect(signUp.user.email).toBe(email);
    expect(emailMocks.sendEmailVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ email }),
        url: expect.stringContaining("/api/auth/verify-email"),
      }),
    );

    await expect(
      auth.api.signInEmail({ body: { email, password } }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const delivered =
      emailMocks.sendEmailVerificationEmail.mock.calls.at(-1)?.[0];
    if (!delivered) throw new Error("Verification email was not delivered");
    const token = new URL(delivered.url).searchParams.get("token");
    if (!token) throw new Error("Verification email has no token");
    await auth.api.verifyEmail({ query: { token } });

    const response = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    expect(response.status).toBe(200);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("session");
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: setCookie!.split(";")[0]! }),
    });
    expect(session?.user).toMatchObject({ email, name: "Cost Tracker User" });
  });

  it("assigns the newest membership to a new session so dashboard reads are authorized", async () => {
    // SEED_SCENARIOS.reviewFixes.newestMembership owns the ordered Membership
    // precondition. Sign-in is the behavior that selects the newest one.
    const email = "auth-newest-membership-canonical@example.org";
    const password = SEED_USER.password;
    const newestOrganizationId = "auth-newest-organization-canonical";

    const response = await auth.api.signInEmail({
      body: { email, password },
      returnHeaders: true,
    });
    caseSessionTokens.push(response.response.token);
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("Sign-in did not create a session cookie");

    const headers = new Headers({ cookie });
    const session = await auth.api.getSession({ headers });
    expect(session?.session.activeOrganizationId).toBe(newestOrganizationId);

    const client = createRouterClient(router, {
      context: async () => ({ headers }),
    });
    await expect(client.projects.scopes()).resolves.toEqual({
      hosted: false,
      partner: false,
      canCreate: true,
    });
    await expect(
      auth.api.createOrganization({
        body: {
          country: "DE" as const,
          name: "A second Organization",
          slug: `second-${randomUUID()}`,
        },
        headers,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  // Participant entry no longer flows through Better Auth invitations
  // (ADR-0013): no hand-written invitation row, no bridge, no accept call.
  // Email-bound invitations are app-owned; see the participant-onboarding
  // procedure tests for issue/redeem coverage.

  it("starts Google sign-in with the deployed Cost Tracker callback contract", async () => {
    const result = await auth.api.signInSocial({
      body: { provider: "google", callbackURL: "/projects" },
    });

    expect(result.redirect).toBe(true);
    expect(result.url).toContain("accounts.google.com");
    if (!result.url)
      throw new Error("Google sign-in did not return a redirect URL");
    expect(decodeURIComponent(result.url)).toContain(
      `${env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/google`,
    );
  });
});
