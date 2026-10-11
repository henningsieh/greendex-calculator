import "server-only";
import { createRouterClient } from "@orpc/server";
import { headers } from "next/headers";

import { router } from "@/lib/orpc/router";

globalThis.$costTrackerClient = createRouterClient(router, {
  context: async () => ({ headers: await headers() }),
});
