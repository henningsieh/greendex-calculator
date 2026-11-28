import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithMessages } from "@/__tests__/render-with-messages";
import { ClaimStatusBadge } from "@/features/claims/components/claim-status-badge";

describe("ClaimStatusBadge", () => {
  it.each([
    null,
    "in_preparation",
    "submitted",
    "correction_requested",
    "approved",
    "rejected",
    "paid",
  ] as const)("renders %s", (status) => {
    renderWithMessages(<ClaimStatusBadge status={status} />);
    expect(screen.getByTestId("claim-status")).toHaveAttribute(
      "data-variant",
      "claim-state",
    );
    expect(screen.getByTestId("claim-status")).toHaveAttribute(
      "data-claim-status",
      status ?? "none",
    );
  });
});
