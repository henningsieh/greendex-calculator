export type ParticipantAgreementVersion = {
  id: string;
  contentHash: string;
};

// Development fixture only. Never use this copy to onboard real Participants;
// programme staff and qualified counsel must approve a replacement before production.
// Every change to the exact copy bytes requires a new version ID and SHA-256 hash.
export const AGREEMENT_COPY = `DRAFT — DEVELOPMENT ONLY — NOT AN OPERATIVE PARTICIPANT AGREEMENT
Counsel and programme approval required before any real Participant uses this app. This fictional draft is for testing the Cost Tracker onboarding flow only.

1. Parties and scope
You are the User accepting this app-wide Participant Agreement for Cost Tracker. Your Participant Invitations or Participant Registration Links relate to a named Project and its Hosting Organization and Partner Organization. Joining creates a Project Participation; it does not make you a member of the Partner Organization. This app record does not replace a signed action-specific participant grant agreement or learning agreement. The applicable signed grant terms and programme rules control funding and participation duties.

2. Participation and conduct
Provide your correct full name and accurate participation details; correct errors promptly. Follow the Project organizer's instructions, applicable safety and nondiscrimination rules, and the activity and reporting requirements in your actual grant terms. This draft does not define a universal conduct code.

3. Participant Journey
A Partner-side Group Organizer records one Participant Journey per Project Participation: your real origin, destination, one-way or round-trip type, and the Erasmus Distance-Calculator distance. Notify the organizer when travel plans change or are cancelled. The funding distance band uses the calculator's one-way origin-to-venue distance, not ticket mileage or doubled round-trip kilometres; action-specific itinerant rules may differ.

4. Travel funding and eligibility
The Project's applicable action, year, funding rules, and distance band determine the displayed app cap. Displayed estimates are not promises of payment. Erasmus+ standard travel support is generally a unit-cost contribution, not automatically reimbursement of ticket receipts or a legal ticket-price ceiling. Cost Tracker separately records actual EUR Travel Cost Entries, Cost Allocations, and a capped Claim for a Partner Organization. Exceptional real-cost support requires its own approval conditions. Eligibility and any payment follow the actual grant and organizer terms.

5. Claims and evidence
Provide genuine, journey-related information and requested Proof Documents, such as tickets, invoices, payment or attendance evidence, where required by the applicable action and organizer. Do not submit duplicate costs; correct mistakes and cooperate with checks. A receipt alone does not establish eligibility, and unit-cost support does not universally require proof of exact expenditure.

6. Review, payment, and correction
The organizer reviews Claims and supporting information under the actual grant and organizer terms. An app estimate or submitted Claim does not guarantee reimbursement. Unsupported information may be corrected or rejected; any recovery of overpayments must follow the actual agreement and applicable law. This draft sets no payment deadline, dispute process, or automatic penalty: those require project-specific terms and counsel review.

7. Records and audits
Provide relevant evidence and cooperate with reasonable organizer or agency checks under the applicable grant. The organizer must confirm who may inspect uploaded Proof Documents and how long each category is retained. Programme beneficiary recordkeeping obligations are not automatically personal retention obligations for every Participant; app retention requires its own lawful justification.

8. Insurance, health, and liability
Ask the organizer to confirm the Project's applicable coverage, including travel, third-party liability, accident or serious illness, and repatriation where relevant. Check your own coverage against those arrangements. Cost Tracker itself supplies no insurance. This draft does not waive statutory duties or determine liability; the organizer and insurer must confirm the operative terms.

9. Privacy
This draft is not a privacy notice. Before real use, the actual controller(s) must identify their contact and any DPO, purposes and lawful basis per purpose for profile, participation, journeys, costs, documents, payment, audit, and acceptance records; recipients, processors, transfers, retention criteria, security, rights, complaint authority, and any automated decisions must also be explained. Uploaded documents should avoid unnecessary sensitive details. Acceptance of this Agreement is evidence of terms acceptance, not GDPR consent for processing; any optional processing based on consent needs a separate freely given choice and withdrawal route.

10. Acceptance and exit
Accepting stores this version ID, content hash, and time as historical evidence. A changed version requires renewed acceptance before Participant access. Contact the organizer about withdrawal from the Project, corrections, claims, or disputes; consequences depend on your actual grant terms. Withdrawal of any separate optional data-processing consent does not necessarily erase records held under another lawful basis. No Project withdrawal or appeal procedure is created by this development draft.`;

export const CURRENT_PARTICIPANT_AGREEMENT_VERSION: ParticipantAgreementVersion =
  {
    id: "eu-erasmus-dev-v1",
    contentHash:
      "2840424522baaee27f36aa3e79181d49b8d548067d24d505b3ee58f01ef2763f",
  };

export function isPublishedAgreement(version: ParticipantAgreementVersion) {
  return Boolean(version.contentHash) && !version.id.startsWith("PENDING-");
}
