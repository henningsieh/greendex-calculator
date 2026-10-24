import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ClaimReview,
  ClaimDecisionPanel,
  ClaimHistory,
  ClaimReviewDetails,
} from "@/features/projects/components/claim-review";

const access = vi.hoisted(() => ({
  role: "coordinator",
  canReview: true,
}));
vi.mock("@/lib/auth-client", async (importOriginal) => {
  const { authClient } =
    await importOriginal<typeof import("@/lib/auth-client")>();
  return {
    authClient: {
      ...authClient,
      organization: authClient.organization,
      useSession: () => ({ data: { user: { id: "reviewer" } } }),
      useActiveOrganization: () => ({
        data: { members: [{ userId: "reviewer", role: access.role }] },
      }),
    },
  };
});
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({}),
  useSuspenseQueries: () => [
    { data: { status: "submitted", approvedAmountEur: "726.00" } },
    { data: [] },
    { data: { canReview: access.canReview } },
    {
      data: {
        entries: [],
        journeys: [],
        payoutAccount: null,
        approvedAmountEur: "726.00",
      },
    },
  ],
}));
beforeEach(() => {
  access.role = "coordinator";
  access.canReview = true;
});

const history = [
  {
    eventType: "correction_requested" as const,
    reason: "Fix receipt",
    actorUserId: "host",
    occurredAt: new Date("2026-01-01"),
  },
  {
    eventType: "rejected" as const,
    reason: "Ineligible",
    actorUserId: "host",
    occurredAt: new Date("2026-01-02"),
  },
  {
    eventType: "reopened" as const,
    reason: "Mistaken rejection",
    actorUserId: "host",
    occurredAt: new Date("2026-01-03"),
  },
];

const base = {
  partnershipId: "partner",
  canReview: true,
  status: "submitted" as const,
  approvedAmountEur: "726.00",
  onDecision: vi.fn().mockResolvedValue(undefined),
};

describe("Claim decisions", () => {
  it.each(["coordinator", "owner", "admin"])(
    "offers decisions for an authorized %s through Better Auth permissions",
    (role) => {
      access.role = role;
      render(<ClaimReview partnershipId="partner" />);
      expect(
        screen.getByRole("button", { name: "Approve Claim" }),
      ).toBeInTheDocument();
    },
  );
  it.each(["participant", ""])(
    "fails closed for client role %s despite a server hint",
    (role) => {
      access.role = role;
      render(<ClaimReview partnershipId="partner" />);
      expect(screen.queryByRole("button", { name: "Approve Claim" })).toBeNull();
    },
  );
  it("retains the authoritative assignment/scope refusal despite a client permission", () => {
    access.canReview = false;
    render(<ClaimReview partnershipId="partner" />);
    expect(screen.queryByRole("button", { name: "Approve Claim" })).toBeNull();
  });

  it("renders a Hosting reviewer snapshot with cost allocations, proof references, payout and journeys", () => {
    render(
      <ClaimReviewDetails
        partnershipId="partner"
        details={{
          approvedAmountEur: "726.00",
          payoutAccount: { accountHolder: "Partner", iban: "DE123", bic: null },
          entries: [
            {
              id: "cost",
              transportProfile: "train",
              amountEur: "800.00",
              allocationMethod: "equal",
              allocations: [
                {
                  participantId: "person",
                  participantName: "Robin",
                  amountEur: "800.00",
                  percentage: null,
                },
              ],
              documents: [
                {
                  id: "proof",
                  originalFileName: "receipt.pdf",
                  mediaType: "application/pdf",
                  byteSize: 50,
                },
              ],
            },
          ],
          journeys: [
            {
              participantId: "person",
              participantName: "Robin",
              origin: "Berlin",
              destination: "Riga",
              tripType: "one-way",
              erasmusDistanceKm: "850.00",
            },
          ],
        }}
      />,
    );
    expect(screen.getByTestId("payout-account-holder")).toBeVisible();
    expect(screen.getByTestId("payout-account-iban")).toHaveClass("font-mono");
    const costRow = document.querySelector("#cost-cost");
    expect(costRow).toHaveAttribute("data-transport-profile", "train");
    expect(costRow).toHaveAttribute("data-amount-eur", "800.00");
    expect(costRow?.querySelectorAll("td")).toHaveLength(4);
    expect(screen.getByTestId("allocation-share-person")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /Travel Cost Entries table/ }),
    ).toHaveAttribute("tabindex", "0");
    expect(
      screen.getByRole("link", { name: "Download Proof Document: receipt.pdf" }),
    ).toHaveAttribute(
      "href",
      "/api/proof-documents?partnershipId=partner&documentId=proof",
    );
    const journey = screen.getByTestId("review-journey-person");
    expect(journey).toHaveAttribute("data-trip-type", "one-way");
    expect(journey).toHaveAttribute("data-distance-km", "850.00");
    expect(screen.getByTestId("review-approved-payable")).toHaveAttribute(
      "data-amount-eur",
      "726.00",
    );
  });
  it("hides every decision from unauthorized viewers", () => {
    render(<ClaimDecisionPanel {...base} canReview={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("requires reasons and explicit confirmation before correction and rejection", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(<ClaimDecisionPanel {...base} onDecision={onDecision} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Request correction" }),
    );
    expect(
      screen.getByRole("button", { name: "Confirm correction request" }),
    ).toBeDisabled();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Correction reason" }),
      "Fix receipt",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm correction request" }),
    );
    expect(onDecision).toHaveBeenCalledWith("requestCorrection", {
      partnershipId: "partner",
      reason: "Fix receipt",
    });
    expect(onDecision).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Reject Claim" }));
    expect(
      screen.getByRole("button", { name: "Confirm rejection" }),
    ).toBeDisabled();
  });

  it("confirms approval without offering payment until approved", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(<ClaimDecisionPanel {...base} onDecision={onDecision} />);
    expect(screen.queryByRole("button", { name: "Mark paid" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Approve Claim" }));
    expect(onDecision).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm approval" }),
    );
    expect(onDecision).toHaveBeenCalledWith("approve", {
      partnershipId: "partner",
    });
  });

  it("separates approved-unpaid transfer from paid-flag correction, requiring a correction reason", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <ClaimDecisionPanel {...base} status="approved" onDecision={onDecision} />,
    );
    expect(document.querySelector("[data-review-status]")).toHaveAttribute(
      "data-review-status",
      "approved",
    );
    expect(
      screen.queryByRole("button", { name: "Correct paid flag" }),
    ).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Mark paid" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onDecision).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm payment" })).toBeEnabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm payment" }),
    );
    expect(onDecision).toHaveBeenCalledWith("markPaid", {
      partnershipId: "partner",
      amountEur: "726.00",
    });
    rerender(
      <ClaimDecisionPanel {...base} status="paid" onDecision={onDecision} />,
    );
    expect(document.querySelector("[data-review-status]")).toHaveAttribute(
      "data-review-status",
      "paid",
    );
    expect(screen.queryByRole("button", { name: "Mark paid" })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Correct paid flag" }),
    );
    expect(
      screen.getByRole("button", { name: "Confirm paid-flag correction" }),
    ).toBeDisabled();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Paid-flag correction reason" }),
      { target: { value: "Recorded in error" } },
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm paid-flag correction" }),
    );
    expect(onDecision).toHaveBeenCalledWith("correctPayment", {
      partnershipId: "partner",
      reason: "Recorded in error",
    });
  });

  it("shows review reasons and confirms an unpaid reopen without a payment shortcut", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <>
        <ClaimHistory events={history} />
        <ClaimDecisionPanel
          {...base}
          status="rejected"
          approvedAmountEur={null}
          onDecision={onDecision}
        />
      </>,
    );
    const events = within(
      screen.getByRole("region", { name: "Claim history" }),
    ).getAllByRole("listitem");
    expect(events).toHaveLength(3);
    for (const [index, eventType] of [
      "correction_requested",
      "rejected",
      "reopened",
    ].entries()) {
      const event = events[index];
      expect(event).toHaveAttribute("data-history-event", eventType);
      expect(within(event).getByTestId("history-reason")).toBeVisible();
    }
    expect(screen.queryByRole("button", { name: "Mark paid" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Reopen Claim" }));
    expect(onDecision).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm reopening" }),
    );
    expect(onDecision).toHaveBeenCalledExactlyOnceWith("reopen", {
      partnershipId: "partner",
    });
    rerender(
      <ClaimDecisionPanel
        {...base}
        status="submitted"
        approvedAmountEur={null}
        onDecision={onDecision}
      />,
    );
    expect(document.querySelector("[data-review-status]")).toHaveAttribute(
      "data-review-status",
      "submitted",
    );
    expect(
      screen.getByRole("button", { name: "Request correction" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Approve Claim" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject Claim" })).toBeEnabled();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
