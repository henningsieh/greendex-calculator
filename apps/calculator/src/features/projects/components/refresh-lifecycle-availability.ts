import { ORPCError } from "@orpc/client";
import type { QueryClient } from "@tanstack/react-query";

import { orpcQuery } from "@/lib/orpc/orpc";

export function refreshLifecycleAvailabilityOnRefusal(
  error: unknown,
  queryClient: QueryClient,
  projectId: string,
) {
  if (
    !(error instanceof ORPCError) ||
    (error.code !== "FORBIDDEN" && error.code !== "NOT_FOUND")
  )
    return;
  void queryClient.invalidateQueries({
    queryKey: orpcQuery.projects.list.queryKey(),
  });
  void queryClient.invalidateQueries({
    queryKey: orpcQuery.projects.getById.queryKey({ input: { id: projectId } }),
  });
}
