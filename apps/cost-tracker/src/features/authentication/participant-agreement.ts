export type ParticipantAgreementVersion = {
  id: string;
  contentHash: string;
};

// Publication requires legal-approved copy and its hash. A copy change must bump the ID.
// Until then the acceptance endpoint refuses to fabricate legal evidence.
export const CURRENT_PARTICIPANT_AGREEMENT_VERSION: ParticipantAgreementVersion =
  {
    id: "PENDING-LEGAL-001",
    contentHash: "",
  };

export function isPublishedAgreement(version: ParticipantAgreementVersion) {
  return Boolean(version.contentHash) && !version.id.startsWith("PENDING-");
}
