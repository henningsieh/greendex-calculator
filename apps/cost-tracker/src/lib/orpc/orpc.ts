import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { Router } from "@/lib/orpc/router";

declare global {
  var $costTrackerClient: RouterClient<Router> | undefined;
}

const link = new RPCLink({
  url: () => {
    if (typeof window === "undefined") {
      throw new Error("RPCLink is not allowed on the server side.");
    }

    return `${window.location.origin}/api/rpc`;
  },
});

export const orpc: RouterClient<Router> =
  globalThis.$costTrackerClient ?? createORPCClient(link);

export const orpcQuery = createTanstackQueryUtils(orpc);
