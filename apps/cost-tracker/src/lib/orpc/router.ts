import type { InferRouterOutputs } from "@orpc/server";

import { participantOnboarding } from "@/features/authentication/participant-onboarding-procedures";
import {
  createOrganization,
  signIn,
  signOut,
  signUp,
  startGoogleSignIn,
  updateUser,
} from "@/features/authentication/procedures";
import {
  assignPartnerCoordinator,
  removePartnerCoordinator,
} from "@/features/projects/procedures/coordination";
import { participations } from "@/features/projects/procedures/participations";
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
  participantOnboarding,
  participations,
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
    assignPartnerCoordinator,
    removePartnerCoordinator,
  },
};

export type Router = typeof router;
export type Outputs = InferRouterOutputs<Router>;
