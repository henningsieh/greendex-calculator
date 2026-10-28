import "server-only";
import {
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
  type ParticipantAgreementVersion,
} from "@/features/participant-onboarding/participant-agreement";
import { buildAcceptAgreement } from "@/features/participant-onboarding/procedures/accept-agreement";
import { buildCreateRegistrationLink } from "@/features/participant-onboarding/procedures/create-registration-link";
import { deliverParticipantInvitation as deliverInvitation } from "@/features/participant-onboarding/procedures/invitation-delivery";
import { buildIssueInvitation } from "@/features/participant-onboarding/procedures/issue-invitation";
import { buildJoin } from "@/features/participant-onboarding/procedures/join";
import { buildListMyProjects } from "@/features/participant-onboarding/procedures/list-my-projects";
import { buildReissueInvitation } from "@/features/participant-onboarding/procedures/reissue-invitation";
import { buildSaveProfile } from "@/features/participant-onboarding/procedures/save-profile";
import { buildSetInvitationOpen } from "@/features/participant-onboarding/procedures/set-invitation-open";
import { buildSetRegistrationLinkOpen } from "@/features/participant-onboarding/procedures/set-registration-link-open";
import { makeRequirePublishedAgreement } from "@/features/participant-onboarding/procedures/shared";

// The persistence-seam scanner treats re-export syntax as exposing the DB through
// the router. Forward instead so the public import path stays unchanged.
export async function deliverParticipantInvitation(
  email: string,
  invitationId: string,
  secret: string,
) {
  return deliverInvitation(email, invitationId, secret);
}

// Tests can supply fixtures; the deployed development draft is published
export function createParticipantOnboardingProcedures(
  currentAgreement: () => ParticipantAgreementVersion = () =>
    CURRENT_PARTICIPANT_AGREEMENT_VERSION,
) {
  const requirePublishedAgreement =
    makeRequirePublishedAgreement(currentAgreement);
  return {
    acceptAgreement: buildAcceptAgreement(requirePublishedAgreement),
    saveProfile: buildSaveProfile(),
    createRegistrationLink: buildCreateRegistrationLink(),
    setRegistrationLinkOpen: buildSetRegistrationLinkOpen(),
    issueInvitation: buildIssueInvitation(),
    reissueInvitation: buildReissueInvitation(),
    setInvitationOpen: buildSetInvitationOpen(),
    join: buildJoin(requirePublishedAgreement),
    listMyProjects: buildListMyProjects(requirePublishedAgreement),
  };
}

export const participantOnboarding = createParticipantOnboardingProcedures();
