import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { Router } from "@/lib/orpc/router";

declare global {
  var $client: RouterClient<Router> | undefined;
}

/**
 * RPC Link configuration for client-side requests
 * Only used in browser environments
 */
const link = new RPCLink({
  url: "/api/rpc",
  origin: () => {
    if (typeof window === "undefined") {
      throw new Error("RPCLink is not allowed on the server side.");
    }

    return window.location.origin;
  },
  headers: () => {
    // Client-side headers can be added here if needed
    return {};
  },
});

/**
 * oRPC client
 * Uses server-side client during SSR if available, falls back to browser client
 * This provides optimal performance by avoiding HTTP requests during SSR
 */
export const orpc: RouterClient<Router> =
  globalThis.$client ?? createORPCClient(link);

/**
 * TanStack Query utilities for oRPC
 * Provides type-safe query and mutation hooks
 * Note: This should only be imported in client components
 */
export const orpcQuery = createTanstackQueryUtils(orpc);
