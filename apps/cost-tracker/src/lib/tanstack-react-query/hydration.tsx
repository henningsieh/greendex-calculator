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
 * The error is deliberately logged during development rather than preventing
 * the page shell from streaming.
 */
export function swallowPrefetchError(error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error("[prefetch] swallowed error:", error);
  }
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
