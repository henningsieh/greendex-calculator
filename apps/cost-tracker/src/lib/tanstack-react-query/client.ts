import {
  defaultShouldDehydrateQuery,
  QueryCache,
  QueryClient,
  type QueryCacheConfig,
} from "@tanstack/react-query";

import { serializer } from "@/lib/serializer";

export function createQueryClient(queryCacheConfig?: QueryCacheConfig) {
  return new QueryClient({
    queryCache: queryCacheConfig ? new QueryCache(queryCacheConfig) : undefined,
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        queryKeyHashFn(queryKey) {
          const [json, meta] = serializer.serialize(queryKey);
          return JSON.stringify({ json, meta });
        },
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
        serializeData(data) {
          const [json, meta] = serializer.serialize(data);
          return { json, meta };
        },
      },
      hydrate: {
        deserializeData: (data) => serializer.deserialize(data.json, data.meta),
      },
    },
  });
}
