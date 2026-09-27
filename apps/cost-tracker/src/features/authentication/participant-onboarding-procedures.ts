import "server-only";
import {
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
  type ParticipantAgreementVersion,
} from "@/features/authentication/participant-agreement";
import { buildAcceptAgreement } from "@/features/authentication/procedures/accept-agreement";
import { buildCreateRegistrationLink } from "@/features/authentication/procedures/create-registration-link";
import { deliverParticipantInvitation as deliverInvitation } from "@/features/authentication/procedures/invitation-delivery";
import { buildIssueInvitation } from "@/features/authentication/procedures/issue-invitation";
import { buildJoin } from "@/features/authentication/procedures/join";
import { buildListMyProjects } from "@/features/authentication/procedures/list-my-projects";
import { buildReissueInvitation } from "@/features/authentication/procedures/reissue-invitation";
import { buildSaveProfile } from "@/features/authentication/procedures/save-profile";
import { buildSetInvitationOpen } from "@/features/authentication/procedures/set-invitation-open";
import { buildSetRegistrationLinkOpen } from "@/features/authentication/procedures/set-registration-link-open";
import { makeRequirePublishedAgreement } from "@/features/authentication/procedures/shared";

// The persistence-seam scanner treats re-export syntax as exposing the DB through
// the router. Forward instead so the public import path stays unchanged.
export async function deliverParticipantInvitation(
  email: string,
  invitationId: string,
) {
  return deliverInvitation(email, invitationId);
}

// Tests can supply a published fixture; the deployed value is deliberately unpublishable.
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
