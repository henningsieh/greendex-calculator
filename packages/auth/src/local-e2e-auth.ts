import { z } from "zod";

export const localE2EAuthEnvironment = {
  LOCAL_E2E_AUTH: z.enum(["0", "1"]).optional(),
  GREENDEX_LOCAL_TEST_SERVER: z.enum(["0", "1"]).optional(),
};

type LocalE2EAuthEnvironment = z.infer<
  z.ZodObject<typeof localE2EAuthEnvironment>
>;

export function localE2EAuthEnabled(env: LocalE2EAuthEnvironment): boolean {
  return (env.LOCAL_E2E_AUTH ?? env.GREENDEX_LOCAL_TEST_SERVER ?? "0") === "1";
}
