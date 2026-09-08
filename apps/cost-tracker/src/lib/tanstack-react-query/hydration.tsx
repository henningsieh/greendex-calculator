import "server-only";
import {
  dehydrate,
  HydrationBoundary,
  type QueryClient,
} from "@tanstack/react-query";
import { cache } from "react";

import { createQueryClient } from "@/lib/tanstack-react-query/client";

export const getQueryClient = cache(createQueryClient);

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
