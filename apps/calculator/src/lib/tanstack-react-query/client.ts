import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";

import { serializer } from "@/lib/serializer";

/**
 * Create a QueryClient preconfigured for the application's serialization and dehydration behavior.
 *
 * The client uses a serializer to produce stable query key hashes and to serialize/deserialize cached data.
 * - Query keys are hashed into a JSON string containing `json` and `meta`.
 * - Queries have a `staleTime` of 60,000 ms.
 * - Dehydration will include queries that meet the default criteria or whose state status is `"pending"`.
 * - Serialized data is returned as an object with `json` and `meta`; hydration reconstructs data from those fields.
 *
 * @returns The configured QueryClient instance
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn(queryKey) {
          const { json, meta } = serializer.serialize(queryKey);
          return JSON.stringify({
            json,
            meta,
          });
        },
        staleTime: 60 * 1000, // With SSR, > 0 to prevent immediate refetching on client mount
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
        serializeData(data) {
          const { json, meta } = serializer.serialize(data);
          return {
            json,
            meta,
          };
        },
      },
      hydrate: {
        deserializeData: (data) => serializer.deserialize(data),
      },
    },
  });
}
