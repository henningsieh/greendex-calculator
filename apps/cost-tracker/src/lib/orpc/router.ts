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
  getDraft,
  saveDraft,
  selectPayoutAccount,
} from "@/features/projects/procedures/claims";
import {
  assignPartnerCoordinator,
  removePartnerCoordinator,
} from "@/features/projects/procedures/coordination";
import {
  linkDocument as linkCostDocument,
  list as listCosts,
  save as saveCost,
} from "@/features/projects/procedures/costs";
import {
  list as listJourneys,
  save as saveJourney,
} from "@/features/projects/procedures/journeys";
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
import { submit } from "@/features/projects/procedures/submission";

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
  claims: { getDraft, saveDraft, selectPayoutAccount, submit },
  costs: { list: listCosts, save: saveCost, linkDocument: linkCostDocument },
  journeys: { list: listJourneys, save: saveJourney },
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
