import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]),
    PORT: z.preprocess(
      (val) => (typeof val === "string" ? Number(val) : val),
      z.number().int().min(1).max(65_535),
    ),
    ORPC_DEV_DELAY_MS: z.preprocess(
      (val) => (typeof val === "string" ? Number(val) : val),
      z.number().int().min(0),
    ),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    GOOGLE_CLIENT_ID: z
      .string()
      .refine(
        (value) =>
          /^[0-9]{12}-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value),
        {
          message:
            "Must match <12 digits>-<id>.apps.googleusercontent.com exactly",
        },
      ),
    GOOGLE_CLIENT_SECRET: z
      .string()
      .refine((value) => value.startsWith("GOCSPX"), {
        message: "Must start with GOCSPX",
      }),
    DISCORD_CLIENT_ID: z.string().min(19),
    DISCORD_CLIENT_SECRET: z.string().length(32),
    GITHUB_CLIENT_ID: z.string().length(20),
    GITHUB_CLIENT_SECRET: z.string().length(40),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.preprocess(
      (val) => (typeof val === "string" ? Number(val) : val),
      z
        .number()
        .int()
        .refine((v) => v === 465 || v === 587, {
          message: "SMTP_PORT must be 465 or 587",
        }),
    ),
    SMTP_SENDER: z.email(),
    SMTP_USERNAME: z.string().min(1),
    SMTP_PASSWORD: z.string().min(1),
    SMTP_SECURE: z
      .string()
      .refine((value) => value === "true" || value === "false", {
        message: "Must be 'true' or 'false'",
      })
      .transform((value) => value === "true"),
    SOCKET_PORT: z.preprocess(
      (val) => (typeof val === "string" ? Number(val) : val),
      z.number().int().min(1).max(65_535),
    ),
  },
  client: {
    NEXT_PUBLIC_BASE_URL: z.url(),
    NEXT_PUBLIC_SOCKET_URL: z.url(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SENDER: process.env.SMTP_SENDER,
    SMTP_USERNAME: process.env.SMTP_USERNAME,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_SECURE: process.env.SMTP_SECURE,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    ORPC_DEV_DELAY_MS: process.env.ORPC_DEV_DELAY_MS,
    SOCKET_PORT: process.env.SOCKET_PORT,
  },
});
