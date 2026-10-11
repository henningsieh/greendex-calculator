"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { toast } from "@/components/ui/toast";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { createORPCErrorToastGrouper } from "@/lib/orpc/error-toast-grouping";
import { createQueryClient } from "@/lib/tanstack-react-query/client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const errorToastGrouper = createORPCErrorToastGrouper();

    return createQueryClient({
      onError(error, query) {
        if (
          query.options.meta?.costTrackerORPC !== true ||
          query.state.data === undefined ||
          !errorToastGrouper.shouldShow(error)
        ) {
          return;
        }

        toast.add({
          description: getORPCRequestErrorMessage(error).text,
          title: "Could not refresh data",
          type: "error",
        });
      },
    });
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
