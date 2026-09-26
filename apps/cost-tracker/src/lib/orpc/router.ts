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
  assignPartnership,
  listPartnerships,
  removePartnership,
} from "@/features/projects/procedures/partnerships";
import {
  availableScopes,
  getProject,
  listHosted,
  listPartner,
} from "@/features/projects/procedures/projects";
import {
  consumeSetupLink,
  createSetupLink,
  disableSetupLink,
} from "@/features/projects/procedures/setup-links";

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
    get: getProject,
    listHosted,
    listPartner,
    scopes: availableScopes,
  },
  projectPartnerships: {
    assign: assignPartnership,
    list: listPartnerships,
    remove: removePartnership,
    createSetupLink,
    disableSetupLink,
    consumeSetupLink,
  },
};

export type Router = typeof router;
export type Outputs = InferRouterOutputs<Router>;
