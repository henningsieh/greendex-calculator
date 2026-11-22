import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithMessages } from "@/__tests__/render-with-messages";
import { ClaimStatusBadge } from "@/features/claims/components/claim-status-badge";

describe("ClaimStatusBadge", () => {
  it.each([
    [null, "secondary"],
    ["in_preparation", "secondary"],
    ["submitted", "status-attention"],
    ["correction_requested", "status-correction"],
    ["approved", "status-success"],
    ["rejected", "status-destructive-solid"],
    ["paid", "status-success-solid"],
  ] as const)("renders %s as %s", (status, variant) => {
    renderWithMessages(<ClaimStatusBadge status={status} />);
    expect(screen.getByTestId("claim-status")).toHaveAttribute(
      "data-variant",
      variant,
    );
    expect(screen.getByTestId("claim-status")).toHaveAttribute(
      "data-claim-status",
      status ?? "none",
    );
  });
});
