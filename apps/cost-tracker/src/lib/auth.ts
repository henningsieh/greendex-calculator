import { organizationRoles, accessControl } from "@greendex/auth";
import { db } from "@greendex/database";
import * as schema from "@greendex/database/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";

import { env } from "@/env";
import { emailSender } from "@/lib/email";

export const auth = betterAuth({
  appName: "Cost Tracker",
  baseURL: env.NEXT_PUBLIC_BASE_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: ({ user, url }) =>
      emailSender.sendPasswordResetEmail({ user, url }),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: ({ user, url }) =>
      emailSender.sendEmailVerificationEmail({ user, url }),
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    organization({ ac: accessControl, roles: organizationRoles }),
    nextCookies(),
  ],
});
