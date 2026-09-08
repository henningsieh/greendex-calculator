import type { InferRouterOutputs } from "@orpc/server";

import {
  listPartnerOrganizations,
  listProjects,
} from "@/features/projects/procedures";

export const router = {
  projects: { list: listProjects },
  partnerOrganizations: { list: listPartnerOrganizations },
};

export type Router = typeof router;
export type Outputs = InferRouterOutputs<Router>;
