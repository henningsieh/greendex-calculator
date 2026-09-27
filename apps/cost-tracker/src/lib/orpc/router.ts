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
  listPayoutAccounts,
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
import { list as listDocuments } from "@/features/projects/procedures/documents";
import { duplicateReviews } from "@/features/projects/procedures/duplicate-reviews";
import {
  list as listJourneys,
  save as saveJourney,
  update as updateJourney,
} from "@/features/projects/procedures/journeys";
import { listOnboardingProgress } from "@/features/projects/procedures/onboarding-progress";
import { participations } from "@/features/projects/procedures/participations";
import {
  assignPartnership,
  listPartnerships,
  removePartnership,
} from "@/features/projects/procedures/partnerships";
import { correctPayment, markPaid } from "@/features/projects/procedures/payment";
import {
  availableScopes,
  complete,
  getProject,
  listHosted,
  listPartner,
} from "@/features/projects/procedures/projects";
import {
  approve,
  getHistory,
  getReviewDetails,
  reject,
  reopen,
  requestCorrection,
  reviewerAccess,
} from "@/features/projects/procedures/review";
import {
  consumeSetupLink,
  createSetupLink,
  disableSetupLink,
} from "@/features/projects/procedures/setup-links";
import {
  previewSubmission,
  submit,
} from "@/features/projects/procedures/submission";

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
  participations: { ...participations, listOnboardingProgress },
  duplicateReviews,
  claims: {
    getDraft,
    listPayoutAccounts,
    saveDraft,
    selectPayoutAccount,
    submit,
    previewSubmission,
    getHistory,
    getReviewDetails,
    reviewerAccess,
    requestCorrection,
    approve,
    markPaid,
    correctPayment,
    reject,
    reopen,
  },
  costs: { list: listCosts, save: saveCost, linkDocument: linkCostDocument },
  documents: { list: listDocuments },
  journeys: { list: listJourneys, save: saveJourney, update: updateJourney },
  projects: {
    get: getProject,
    complete,
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
