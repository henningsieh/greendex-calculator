import { createServerAuth } from "@greendex/auth";

import { env } from "@/env";
import { emailSender } from "@/lib/email";

export const auth = createServerAuth({
  appName: "Cost Tracker",
  baseURL: env.NEXT_PUBLIC_BASE_URL,
  secret: env.BETTER_AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  emailSender,
});
