import "server-only";
import {
  dehydrate,
  HydrationBoundary,
  type QueryClient,
} from "@tanstack/react-query";
import { cache } from "react";

import { createQueryClient } from "@/lib/tanstack-react-query/client";

export const getQueryClient = cache(createQueryClient);

/**
 * Lets a client suspense query retry if its optional server prefetch fails.
 * Logs a safe error classification and lets the client retry the query.
 * Avoid logging the error object: request and transport details may be sensitive.
 */
export function swallowPrefetchError(error: unknown) {
  console.error("[prefetch] request failed; the client will retry", {
    type: error instanceof Error ? error.name : typeof error,
  });
}

export function HydrateClient({
  children,
  client,
}: {
  children: React.ReactNode;
  client: QueryClient;
}) {
  return (
    <HydrationBoundary state={dehydrate(client)}>{children}</HydrationBoundary>
  );
}
