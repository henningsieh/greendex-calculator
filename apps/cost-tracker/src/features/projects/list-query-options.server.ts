import "server-only";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { headers } from "next/headers";

import {
  getProjectListQueryInput,
  type HostedProjectListQueryOptions,
  type PartnerProjectListQueryOptions,
  type ProjectListScope,
  type ProjectListState,
} from "@/features/projects/list-query-options";
import type {
  HostedProjectList,
  PartnerProjectList,
} from "@/features/projects/types";
import { router } from "@/lib/orpc/router";

/**
 * Builds Project-list query options against a request-local router client.
 *
 * The process-wide `globalThis.$costTrackerClient` above exists to satisfy the
 * SSR initialization order, but it is created once. In development a hot
 * update of a procedure replaces the RPC route while that long-lived client
 * can keep the previous router; server rendering would then hydrate a
 * different URL result than the browser RPC path. Creating the client per
 * request keeps both sides on the current procedure code, and the shared
 * input builder keeps their query keys identical.
 */
export function getServerProjectListQueryOptions(
  scope: "hosted",
  state: ProjectListState,
): HostedProjectListQueryOptions;
export function getServerProjectListQueryOptions(
  scope: "partner",
  state: ProjectListState,
): PartnerProjectListQueryOptions;
export function getServerProjectListQueryOptions(
  scope: ProjectListScope,
  state: ProjectListState,
): HostedProjectListQueryOptions | PartnerProjectListQueryOptions;
export function getServerProjectListQueryOptions(
  scope: ProjectListScope,
  state: ProjectListState,
): HostedProjectListQueryOptions | PartnerProjectListQueryOptions {
  const query = createTanstackQueryUtils(
    createRouterClient(router, {
      context: async () => ({ headers: await headers() }),
    }),
  );
  const input = getProjectListQueryInput(scope, state);

  return scope === "hosted"
    ? query.projects.listHosted.queryOptions<HostedProjectList>({
        input,
        meta: { costTrackerORPC: true },
      })
    : query.projects.listPartner.queryOptions<PartnerProjectList>({
        input,
        meta: { costTrackerORPC: true },
      });
}
