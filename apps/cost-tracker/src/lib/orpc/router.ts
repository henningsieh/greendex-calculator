import type { InferRouterOutputs } from "@orpc/server";

import {
  createOrganization,
  signIn,
  signOut,
  signUp,
  startGoogleSignIn,
  updateUser,
} from "@/features/authentication/procedures";
import {
  availableProjectScopes,
  hostedOverview,
  partnerOverview,
} from "@/features/projects/overview-procedures";
import { projectDetail } from "@/features/projects/project-detail-procedure";
import {
  assignProjectPartnership,
  listProjectPartnerships,
  removeProjectPartnership,
} from "@/features/projects/project-partnership-procedures";

export const router = {
  authentication: {
    createOrganization,
    signIn,
    signOut,
    signUp,
    startGoogleSignIn,
    updateUser,
  },
  projects: {
    availableScopes: availableProjectScopes,
    detail: projectDetail,
    hostedOverview,
    partnerOverview,
  },
  projectPartnerships: {
    assign: assignProjectPartnership,
    list: listProjectPartnerships,
    remove: removeProjectPartnership,
  },
};

export type Router = typeof router;
export type Outputs = InferRouterOutputs<Router>;
