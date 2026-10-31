import { createSafeFieldIssue } from "@/lib/orpc/error-contract";

export const validFieldIssues = [
  createSafeFieldIssue("journeyDistanceOutsideBands", [
    "participations",
    "person",
    "fundingBand",
  ]),
  createSafeFieldIssue("payoutAccountRequired", ["payoutAccount"]),
  createSafeFieldIssue("entryRequired", ["entries"]),
  createSafeFieldIssue("entryRequiredForCheck", ["entries"]),
  createSafeFieldIssue("participationOutsidePartnership", [
    "participations",
    "person",
  ]),
  createSafeFieldIssue("journeyRequired", [
    "participations",
    "person",
    "journey",
  ]),
  createSafeFieldIssue("journeyOriginRequired", [
    "participations",
    "person",
    "journey",
    "origin",
  ]),
  createSafeFieldIssue("journeyDestinationRequired", [
    "participations",
    "person",
    "journey",
    "destination",
  ]),
  createSafeFieldIssue("journeyTripTypeRequired", [
    "participations",
    "person",
    "journey",
    "tripType",
  ]),
  createSafeFieldIssue("journeyDistanceRequired", [
    "participations",
    "person",
    "journey",
    "erasmusDistanceKm",
  ]),
  createSafeFieldIssue("transportProfileOutsideRules", [
    "entries",
    "entry",
    "transportProfile",
  ]),
  createSafeFieldIssue("entryAmountRequired", ["entries", "entry", "amountEur"]),
  createSafeFieldIssue("allocationRequired", ["entries", "entry", "allocations"]),
  createSafeFieldIssue("allocationSharesInvalid", [
    "entries",
    "entry",
    "allocations",
  ]),
  createSafeFieldIssue("proofDocumentRequired", [
    "entries",
    "entry",
    "proofDocuments",
  ]),
  createSafeFieldIssue("fundingRulesRequired", ["fundingRules"]),
];
