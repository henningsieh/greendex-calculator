import type { InferRouterInputs } from "@orpc/server";

import type { Router } from "@/lib/orpc/router";

type ClaimInputs = InferRouterInputs<Router>["claims"];

// The panel gathers optional fields before the selected action validates them.
export type ClaimDecisionInput = ClaimInputs["approve"] &
  Partial<Pick<ClaimInputs["requestCorrection"], "reason">> &
  Partial<Pick<ClaimInputs["markPaid"], "amountEur">>;
