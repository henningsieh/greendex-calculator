import { fireEvent, screen, within } from "@testing-library/react";
import type { Route } from "next";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { Button } from "@/components/ui/button";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import {
  ClaimBand,
  ClaimCostTable,
  PayoutAccountLines,
} from "@/features/claims/components/claim-document";

const filename = `${"long-receipt-name-".repeat(12)}.pdf`;

describe("Claim document presentation", () => {
  it("default keeps the stock primary look at large size", () => {
    render(
      <Button data-testid="fixture-claim-action" variant="default" size="lg">
        Claim action
      </Button>,
    );
    const button = screen.getByTestId("fixture-claim-action");
    expect(button).toHaveClass(
      "h-11",
      "rounded-none",
      "bg-primary",
      "text-primary-foreground",
      "hover:bg-primary/80",
      "transition-all",
    );
    expect(button).not.toHaveClass(
      "rounded-full",
      "shadow-primary-glow",
      "border-primary-border",
      "transition-[translate,scale,background-color,border-color,box-shadow]",
      "disabled:pointer-events-none",
      "focus-visible:ring-0",
    );
  });

  it("outline keeps the stock outline look at large size without glow", () => {
    render(
      <Button data-testid="fixture-claim-action" variant="outline" size="lg">
        Claim action
      </Button>,
    );
    const button = screen.getByTestId("fixture-claim-action");
    expect(button).toHaveClass(
      "h-11",
      "rounded-none",
      "bg-background",
      "shadow-xs",
      "hover:bg-accent",
      "transition-all",
    );
    expect(button).not.toHaveClass(
      "rounded-full",
      "shadow-primary-glow",
      "shadow-secondary-glow",
      "bg-transparent",
      "focus-visible:ring-0",
      "disabled:pointer-events-none",
    );
  });

  it("uses the stock primary look by default while retaining disabled and invalid states", () => {
    const activate = vi.fn();
    render(
      <Button
        data-testid="fixture-claim-action"
        disabled
        aria-invalid
        onClick={activate}
      >
        Unavailable action
      </Button>,
    );
    const button = screen.getByTestId("fixture-claim-action");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-invalid", "true");
    expect(button).toHaveClass(
      "h-10",
      "rounded-none",
      "bg-primary",
      "text-primary-foreground",
      "disabled:cursor-not-allowed",
      "disabled:opacity-50",
      "aria-invalid:border-destructive",
      "aria-invalid:ring-2",
      "dark:aria-invalid:border-destructive/50",
      "dark:aria-invalid:ring-destructive/40",
    );
    expect(button).not.toHaveClass(
      "rounded-full",
      "shadow-primary-glow",
      "disabled:pointer-events-none",
      "disabled:data-[variant=default]:bg-pending",
    );
    fireEvent.click(button);
    expect(activate).not.toHaveBeenCalled();
  });

  it("keeps full evidence and exact figures in a keyboard-accessible table with existing edit actions", () => {
    const edit = vi.fn();
    render(
      <ClaimCostTable
        actions
        rows={[
          {
            id: "saved-cost",
            transportProfile: "train",
            amountEur: "428.60",
            allocationMethod: "percentage",
            allocations: (
              <ul>
                <li>Robin: 50.000000%</li>
                <li>Alex: 50.000000%</li>
              </ul>
            ),
            documents: (
              // Public asset, not an app route: typed routes only cover pages.
              <Link href={"/proof-documents/receipt.pdf" as Route}>
                {filename}
              </Link>
            ),
            action: (
              <Button
                data-testid="fixture-edit-cost"
                variant="outline"
                size="lg"
                onClick={edit}
              >
                Edit cost
              </Button>
            ),
          },
        ]}
      />,
    );
    const region = screen
      .getByTestId("claim-cost-table")
      .closest('[data-slot="table-container"]');
    expect(region).toHaveRole("region");
    expect(region).toHaveAttribute("tabindex", "0");
    const row = screen.getAllByRole("row")[1]!;
    expect(row).toHaveAttribute("id", "cost-saved-cost");
    expect(row).toHaveAttribute("data-transport-profile", "train");
    expect(row).toHaveAttribute("data-amount-eur", "428.60");
    expect(within(row).getAllByRole("listitem")).toHaveLength(2);
    expect(within(row).getByRole("link")).toHaveAttribute(
      "href",
      "/proof-documents/receipt.pdf",
    );
    fireEvent.click(within(row).getByTestId("fixture-edit-cost"));
    expect(edit).toHaveBeenCalledOnce();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("omits the entire action column when editing is not offered", () => {
    render(
      <ClaimCostTable
        rows={[
          {
            id: "locked",
            transportProfile: "bus",
            amountEur: "86.40",
            allocationMethod: "equal",
            allocations: "Equal share (computed on submission)",
            documents: "None",
          },
        ]}
      />,
    );
    expect(
      screen.queryByTestId("claim-cost-action-header"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("cell")).toHaveLength(4);
  });

  it("exposes the selected payout account and Claim status independently of selectors", () => {
    render(
      <>
        <ClaimBand title="Claim workspace" status="correction_requested" />
        <PayoutAccountLines
          account={{
            accountHolder: "Partner Organization",
            iban: "DE89370400440532013000",
            bic: "COBADEFFXXX",
          }}
        />
      </>,
    );
    expect(screen.getByTestId("claim-status")).toHaveAttribute(
      "data-status",
      "correction_requested",
    );
    expect(screen.getByTestId("payout-account-iban")).toHaveAttribute(
      "data-iban",
      "DE89370400440532013000",
    );
    expect(screen.getByTestId("payout-account-iban")).toHaveClass(
      "font-mono",
      "select-all",
    );
    expect(screen.getByTestId("payout-bic")).toHaveAttribute(
      "data-bic",
      "COBADEFFXXX",
    );
  });

  it("keeps the default discovery-table density contract unchanged", () => {
    render(
      <Table>
        <thead>
          <tr>
            <TableHead>Project</TableHead>
          </tr>
        </thead>
        <tbody>
          <tr>
            <TableCell>Example</TableCell>
          </tr>
        </tbody>
      </Table>,
    );
    expect(screen.getByRole("columnheader")).toHaveClass(
      "h-12",
      "uppercase",
      "whitespace-nowrap",
    );
    expect(screen.getByRole("cell")).toHaveClass("p-3", "whitespace-nowrap");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
