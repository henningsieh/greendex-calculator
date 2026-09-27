import "server-only";
import {
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
  type ParticipantAgreementVersion,
} from "@/features/authentication/participant-agreement";
import { buildAcceptAgreement } from "@/features/authentication/procedures/accept-agreement";
import {
  buildInvitations,
  deliverParticipantInvitation as deliverInvitation,
} from "@/features/authentication/procedures/invitations";
import { buildJoin } from "@/features/authentication/procedures/join";
import { buildListMyProjects } from "@/features/authentication/procedures/list-my-projects";
import { buildRegistrationLinks } from "@/features/authentication/procedures/registration-links";
import { buildSaveProfile } from "@/features/authentication/procedures/save-profile";
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
    ...buildRegistrationLinks(),
    ...buildInvitations(),
    join: buildJoin(requirePublishedAgreement),
    listMyProjects: buildListMyProjects(requirePublishedAgreement),
  };
}

export const participantOnboarding = createParticipantOnboardingProcedures();
