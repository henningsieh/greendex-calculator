import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import {
  ClaimBand,
  ClaimCostTable,
  PayoutAccountLines,
} from "@/features/projects/components/claim-document";

const filename = `${"long-receipt-name-".repeat(12)}.pdf`;

describe("Claim document presentation", () => {
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
            documents: filename,
            action: (
              <Button
                variant="accounting-outline"
                size="accounting"
                onClick={edit}
              >
                Edit cost
              </Button>
            ),
          },
        ]}
      />,
    );
    const region = screen.getByRole("region", {
      name: /Travel Cost Entries table/,
    });
    expect(region).toHaveAttribute("tabindex", "0");
    const row = screen.getByRole("cell", { name: "train" }).closest("tr")!;
    expect(row).toHaveAttribute("id", "cost-saved-cost");
    expect(within(row).getByRole("cell", { name: "428.60" })).toBeInTheDocument();
    expect(within(row).getByText("Robin: 50.000000%")).toBeInTheDocument();
    expect(within(row).getByText("Alex: 50.000000%")).toBeInTheDocument();
    expect(within(row).getByText(filename)).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Edit cost" }));
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
      screen.queryByRole("columnheader", { name: "Action" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "None" })).toBeInTheDocument();
  });

  it("shows the full selected IBAN separately from the native selector and uses human status text", () => {
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
    expect(screen.getByText("Correction requested")).toBeInTheDocument();
    expect(screen.getByText("DE89370400440532013000")).toHaveClass(
      "font-mono",
      "select-all",
    );
    expect(screen.getByText("COBADEFFXXX")).toBeInTheDocument();
    expect(screen.queryByText("correction_requested")).not.toBeInTheDocument();
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
