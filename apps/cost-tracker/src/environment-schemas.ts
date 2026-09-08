import { z } from "zod";

export const CostTrackerServerEnvironmentSchema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SENDER: z.email(),
  SMTP_USERNAME: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_SECURE: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const CostTrackerClientEnvironmentSchema = z.object({
  NEXT_PUBLIC_BASE_URL: z.url(),
});
