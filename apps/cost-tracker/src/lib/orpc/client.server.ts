import "server-only";
import { createRouterClient, os } from "@orpc/server";
import { headers } from "next/headers";

globalThis.$costTrackerClient = createRouterClient(
  os.lazy(async () => ({ default: (await import("@/lib/orpc/router")).router })),
  { context: async () => ({ headers: await headers() }) },
);
