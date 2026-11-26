import { z } from "zod";

const OriginSchema = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "" &&
    !url.username &&
    !url.password
  );
}, "Expected an origin without path, query, credentials, or fragment.");

const RealtimeEnvironmentSchema = z.object({
  REALTIME_PORT: z.coerce.number().int().min(1).max(65_535),
  REALTIME_BIND_HOST: z.string().min(1),
  REALTIME_PUBLIC_URL: OriginSchema,
  COST_TRACKER_PUBLIC_URL: OriginSchema,
  COST_TRACKER_INTERNAL_URL: OriginSchema,
  REALTIME_EMIT_SECRET: z.string().min(16),
  TEST_RUN_ID: z
    .string()
    .regex(/^[a-f0-9]{32}$/u)
    .optional(),
});

/** Read once at process start; a misconfigured service must not start. */
export const env = RealtimeEnvironmentSchema.parse(process.env);
