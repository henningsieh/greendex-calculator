import { z } from "zod";

export const localE2EAuthEnvironment = {
  GREENDEX_LOCAL_TEST_SERVER: z.enum(["0", "1"]).optional(),
};

type LocalE2EAuthEnvironment = z.infer<
  z.ZodObject<typeof localE2EAuthEnvironment>
>;

/**
 * One switch for every local test-server relaxation. It is honoured only for a
 * loopback auth base URL (see `createServerAuth`), so it can never weaken a
 * public deployment.
 */
export function localE2EAuthEnabled(env: LocalE2EAuthEnvironment): boolean {
  return (env.GREENDEX_LOCAL_TEST_SERVER ?? "0") === "1";
}
