import { createEnv } from "@t3-oss/env-nextjs";

import {
  CostTrackerClientEnvironmentSchema,
  CostTrackerServerEnvironmentSchema,
} from "@/environment-schemas";

export const env = createEnv({
  server: CostTrackerServerEnvironmentSchema.shape,
  client: CostTrackerClientEnvironmentSchema.shape,
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SENDER: process.env.SMTP_SENDER,
    SMTP_USERNAME: process.env.SMTP_USERNAME,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_SECURE: process.env.SMTP_SECURE,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  },
});
