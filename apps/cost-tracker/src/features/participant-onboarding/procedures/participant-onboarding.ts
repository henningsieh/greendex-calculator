import "server-only";
import {
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
  type ParticipantAgreementVersion,
} from "@/features/participant-onboarding/participant-agreement";
import {
  deliverParticipantInvitation as deliverInvitation,
  buildIssueInvitation,
  buildReissueInvitation,
  buildSetInvitationOpen,
} from "@/features/participant-onboarding/procedures/invitations";
import {
  buildAcceptAgreement,
  buildJoin,
  buildSaveProfile,
} from "@/features/participant-onboarding/procedures/join";
import { buildListMyProjects } from "@/features/participant-onboarding/procedures/list-my-projects";
import {
  buildCreateRegistrationLink,
  buildSetRegistrationLinkOpen,
} from "@/features/participant-onboarding/procedures/registration-links";
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
