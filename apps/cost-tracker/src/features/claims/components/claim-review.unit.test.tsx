import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import {
  ClaimReview,
  ClaimDecisionPanel,
  ClaimHistory,
  ClaimReviewDetails,
} from "@/features/claims/components/claim-review";

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
      expect(screen.getByTestId("claim-decision-approve")).toBeInTheDocument();
    },
  );
  it.each(["participant", ""])(
    "fails closed for client role %s despite a server hint",
    (role) => {
      access.role = role;
      render(<ClaimReview partnershipId="partner" />);
      expect(screen.queryByTestId("claim-decision-approve")).toBeNull();
    },
  );
  it("retains the authoritative assignment/scope refusal despite a client permission", () => {
    access.canReview = false;
    render(<ClaimReview partnershipId="partner" />);
    expect(screen.queryByTestId("claim-decision-approve")).toBeNull();
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
      screen
        .getByTestId("claim-cost-table")
        .closest('[data-slot="table-container"]'),
    ).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("download-proof-proof")).toHaveAttribute(
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
    await userEvent.click(screen.getByTestId("claim-decision-requestCorrection"));
    expect(
      screen.getByTestId("claim-decision-confirm-requestCorrection"),
    ).toBeDisabled();
    await userEvent.type(
      screen.getByTestId("claim-decision-reason-requestCorrection"),
      "Fix receipt",
    );
    await userEvent.click(
      screen.getByTestId("claim-decision-confirm-requestCorrection"),
    );
    expect(onDecision).toHaveBeenCalledWith("requestCorrection", {
      partnershipId: "partner",
      reason: "Fix receipt",
    });
    expect(onDecision).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTestId("claim-decision-reject"));
    expect(screen.getByTestId("claim-decision-confirm-reject")).toBeDisabled();
  });

  it("confirms approval without offering payment until approved", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    render(<ClaimDecisionPanel {...base} onDecision={onDecision} />);
    expect(screen.queryByTestId("claim-decision-markPaid")).toBeNull();
    await userEvent.click(screen.getByTestId("claim-decision-approve"));
    expect(onDecision).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("claim-decision-confirm-approve"));
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
    expect(screen.queryByTestId("claim-decision-correctPayment")).toBeNull();
    await userEvent.click(screen.getByTestId("claim-decision-markPaid"));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onDecision).not.toHaveBeenCalled();
    expect(screen.getByTestId("claim-decision-confirm-markPaid")).toBeEnabled();
    await userEvent.click(screen.getByTestId("claim-decision-confirm-markPaid"));
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
    expect(screen.queryByTestId("claim-decision-markPaid")).toBeNull();
    await userEvent.click(screen.getByTestId("claim-decision-correctPayment"));
    expect(
      screen.getByTestId("claim-decision-confirm-correctPayment"),
    ).toBeDisabled();
    fireEvent.change(screen.getByTestId("claim-decision-reason-correctPayment"), {
      target: { value: "Recorded in error" },
    });
    await userEvent.click(
      screen.getByTestId("claim-decision-confirm-correctPayment"),
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
    const events = within(screen.getByTestId("claim-history")).getAllByRole(
      "listitem",
    );
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
    expect(screen.queryByTestId("claim-decision-markPaid")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(screen.getByTestId("claim-decision-reopen"));
    expect(onDecision).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("claim-decision-confirm-reopen"));
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
    expect(screen.getByTestId("claim-decision-requestCorrection")).toBeEnabled();
    expect(screen.getByTestId("claim-decision-approve")).toBeEnabled();
    expect(screen.getByTestId("claim-decision-reject")).toBeEnabled();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
