import type { QueryClient } from "@tanstack/react-query";

import { orpcQuery } from "@/lib/orpc/orpc";

/**
 * Refreshes Project data affected by Project Partnership assignment changes.
 * Shared by the assignment form and the removal flow so both stay in sync.
 */
export async function invalidatePartnershipProjectData(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: orpcQuery.projectPartnerships.list.queryKey(),
    }),
    queryClient.invalidateQueries({
      queryKey: orpcQuery.projects.listHosted.key({ type: "query" }),
    }),
    queryClient.invalidateQueries({
      queryKey: orpcQuery.projects.listPartner.key({ type: "query" }),
    }),
    queryClient.invalidateQueries({
      queryKey: orpcQuery.projects.get.key({ type: "query" }),
    }),
  ]);
}
