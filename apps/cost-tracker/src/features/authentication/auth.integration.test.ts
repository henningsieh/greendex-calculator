// @vitest-environment node

import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import { user, verification } from "@greendex/database/schema";
import { eq, like } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const emailMocks = vi.hoisted(() => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email", () => ({ emailSender: emailMocks }));

import { env } from "@/env";
import { auth } from "@/lib/auth";

const createdEmails: string[] = [];

function uniqueEmail() {
  const email = `cost-tracker-auth-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

afterEach(async () => {
  for (const email of createdEmails.splice(0)) {
    await db.delete(user).where(eq(user.email, email));
    await db
      .delete(verification)
      .where(like(verification.identifier, `%${email}%`));
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

    await db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.email, email));

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

  it("starts Google sign-in with the deployed Cost Tracker callback contract", async () => {
    const result = await auth.api.signInSocial({
      body: { provider: "google", callbackURL: "/dashboard" },
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
