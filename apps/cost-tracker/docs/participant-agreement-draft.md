# Participant Agreement — Development Draft Only

Status: `eu-erasmus-dev-v1` is wired into the Cost Tracker development onboarding pages. It is **fictional test copy, not counsel-approved legal text**. Never use this version for real Participants or production onboarding. The application currently does not enforce a production-only block: deployment owners must ensure this draft cannot be used in production.

The exact UTF-8 bytes of `AGREEMENT_COPY` in [`participant-agreement.ts`](../src/features/authentication/participant-agreement.ts) are SHA-256 hashed into `CURRENT_PARTICIPANT_AGREEMENT_VERSION.contentHash`; a test guards against drift. Acceptance records the version and hash as evidence of terms acceptance, **not GDPR consent**. Acceptance is app-wide for a User and a new version requires renewed acceptance.

The draft covers parties and signed-grant precedence, conduct, Participant Journeys, unit-cost versus actual-cost funding, Claim evidence and review, audits, insurance, privacy, and exit. It supplies no action-specific eligibility, payment, insurance, retention, controller, or legal basis determinations. The app record does not replace a signed participant grant agreement.

Before production: confirm action/call year, signed participant grant agreement and National Agency rules; obtain programme staff and qualified contract/privacy counsel approval of operative copy and privacy notice; confirm actual controller(s), lawful bases, insurer, deadlines, evidence and dispute routes; publish a **new** approved version ID and its exact-copy hash. Do not rename this development draft into production copy.
