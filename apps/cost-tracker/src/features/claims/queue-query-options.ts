import type { UseQueryStatesReturn } from "nuqs";
import {
  createLoader,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import {
  CLAIM_QUEUE_PAGE_SIZES,
  CLAIM_QUEUE_SORTS,
  type ClaimQueueInput,
  type ClaimQueuePageSize,
  type ClaimQueueSort,
} from "@/features/claims/queue-schemas";
import { orpcQuery } from "@/lib/orpc/orpc";

export const claimQueueParsers = {
  search: parseAsString.withDefault(""),
  partnerOrganizationId: parseAsString,
  sort: parseAsStringLiteral(CLAIM_QUEUE_SORTS).withDefault("submitted-asc"),
  cursor: parseAsString.withDefault(""),
  pageSize: parseAsNumberLiteral(CLAIM_QUEUE_PAGE_SIZES).withDefault(25),
};

export const loadClaimQueueSearchParams = createLoader(claimQueueParsers);

export type ClaimQueueUrlState = inferParserType<typeof claimQueueParsers>;
export type ClaimQueueQueryState = UseQueryStatesReturn<typeof claimQueueParsers>;

export type ClaimQueueState = {
  search?: string;
  partnerOrganizationId?: string;
  sort: ClaimQueueSort;
  cursor?: string;
  pageSize: ClaimQueuePageSize;
};

export function normalizeClaimQueueState(
  state: ClaimQueueUrlState,
): ClaimQueueState {
  const search = state.search.trim().toLocaleLowerCase("en");
  return {
    // Any non-empty term filters; whitespace-only resets the constraint.
    search: search || undefined,
    partnerOrganizationId: state.partnerOrganizationId?.trim() || undefined,
    sort: state.sort,
    cursor: state.cursor || undefined,
    pageSize: state.pageSize,
  };
}

export function getClaimQueueQueryOptions(state: ClaimQueueState) {
  const input: ClaimQueueInput = {
    search: state.search,
    partnerOrganizationId: state.partnerOrganizationId,
    sort: state.sort,
    cursor: state.cursor,
    pageSize: state.pageSize,
  };
  return {
    ...orpcQuery.claims.listReviewQueue.queryOptions({
      input,
      meta: { costTrackerORPC: true },
    }),
    meta: { costTrackerORPC: true },
  };
}
