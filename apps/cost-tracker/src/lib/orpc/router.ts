import type { InferRouterOutputs } from "@orpc/server";

import {
  createOrganization,
  onboardingNextStep,
  signIn,
  signOut,
  signUp,
  startGoogleSignIn,
  updateUser,
} from "@/features/authentication/procedures";
import {
  createPayoutAccount,
  getDraft,
  listPayoutAccounts,
  saveDraft,
  selectPayoutAccount,
} from "@/features/claims/procedures/core";
import {
  linkDocument as linkCostDocument,
  list as listCosts,
  save as saveCost,
} from "@/features/claims/procedures/costs";
import { list as listDocuments } from "@/features/claims/procedures/documents";
import { correctPayment, markPaid } from "@/features/claims/procedures/payment";
import {
  approve,
  getHistory,
  getReviewDetails,
  reject,
  reopen,
  requestCorrection,
  reviewerAccess,
} from "@/features/claims/procedures/review";
import {
  previewSubmission,
  submit,
} from "@/features/claims/procedures/submission";
import {
  searchOrganizations,
  listMyOrganizations,
} from "@/features/organizations/procedures/discovery";
import { listMemberships as listOrganizationMemberships } from "@/features/organizations/procedures/memberships";
import {
  getSettings,
  updateCountry,
} from "@/features/organizations/procedures/settings";
import {
  acceptInvitation as acceptOrganizationInvitation,
  rejectInvitation as rejectOrganizationInvitation,
  cancelInvitation as cancelOrganizationInvitation,
  inviteMember as inviteOrganizationMember,
  listMembers as listOrganizationMembers,
  listPendingInvitations as listOrganizationInvitations,
} from "@/features/organizations/procedures/staff-invites";
import { listOnboardingProgress } from "@/features/participant-onboarding/procedures/onboarding-progress";
import { participantOnboarding } from "@/features/participant-onboarding/procedures/participant-onboarding";
import { participations } from "@/features/participations/procedures/core";
import { duplicateReviews } from "@/features/participations/procedures/duplicate-reviews";
import {
  list as listJourneys,
  save as saveJourney,
  update as updateJourney,
} from "@/features/participations/procedures/journeys";
import {
  assignPartnerCoordinator,
  removePartnerCoordinator,
} from "@/features/partnerships/procedures/coordination";
import {
  assignPartnership,
  listPartnerships,
  removePartnership,
} from "@/features/partnerships/procedures/core";
import {
  consumeSetupLink,
  createSetupLink,
  disableSetupLink,
  getSetupLinkEligibility,
  listSetupLinks,
} from "@/features/partnerships/procedures/setup-links";
import {
  availableScopes,
  complete,
  getProject,
  listHosted,
  listPartner,
} from "@/features/projects/procedures/core";
import { create as createProject } from "@/features/projects/procedures/create";
import { searchHosted } from "@/features/projects/procedures/search-hosted";

export const router = {
  authentication: {
    createOrganization,
    onboardingNextStep,
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
    createPayoutAccount,
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
  organizations: {
    getSettings,
    updateCountry,
    search: searchOrganizations,
    listMine: listMyOrganizations,
    listMemberships: listOrganizationMemberships,
    listMembers: listOrganizationMembers,
    listPendingInvitations: listOrganizationInvitations,
    inviteMember: inviteOrganizationMember,
    acceptInvitation: acceptOrganizationInvitation,
    rejectInvitation: rejectOrganizationInvitation,
    cancelInvitation: cancelOrganizationInvitation,
  },
  projects: {
    create: createProject,
    searchHosted,
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
    listSetupLinks,
    disableSetupLink,
    getSetupLinkEligibility,
    consumeSetupLink,
    assignPartnerCoordinator,
    removePartnerCoordinator,
  },
};

export type Router = typeof router;
export type Outputs = InferRouterOutputs<Router>;
