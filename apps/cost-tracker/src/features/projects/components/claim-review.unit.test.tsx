import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ClaimDecisionPanel,
  ClaimHistory,
  ClaimReviewDetails,
} from "@/features/projects/components/claim-review";

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
    expect(screen.getByText(/Partner · DE123/)).toBeInTheDocument();
    expect(screen.getByText(/train · 800.00 EUR/)).toBeInTheDocument();
    expect(screen.getByText(/^Proof Document: receipt.pdf/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Download Proof Document: receipt.pdf" }),
    ).toHaveAttribute(
      "href",
      "/api/proof-documents?partnershipId=partner&documentId=proof",
    );
    expect(screen.getByText(/Berlin → Riga/)).toBeInTheDocument();
    expect(screen.getByText(/726.00 EUR/)).toBeInTheDocument();
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
    expect(screen.getByText("Approved · unpaid")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Correct paid flag" }),
    ).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Mark paid" }));
    expect(screen.getByText(/full bank transfer/)).toBeInTheDocument();
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
    expect(screen.getByText("Paid")).toBeInTheDocument();
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

  it("shows rejection reason and unpaid reopen, with no payment or editing shortcut", async () => {
    render(
      <>
        <ClaimHistory events={history} />
        <ClaimDecisionPanel
          {...base}
          status="rejected"
          approvedAmountEur={null}
        />
      </>,
    );
    expect(screen.getByText("Ineligible")).toBeInTheDocument();
    expect(screen.getByText("Fix receipt")).toBeInTheDocument();
    expect(screen.getByText(/Reopened/)).toBeInTheDocument();
    expect(screen.getByText("Mistaken rejection")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark paid" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Reopen Claim" }));
    expect(screen.getByText(/keeps Partner editing locked/)).toBeInTheDocument();
  });
});
