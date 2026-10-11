import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Outputs } from "@/lib/orpc/router";

const statusLabels: Record<
  NonNullable<Outputs["claims"]["getDraft"]>["status"],
  string
> = {
  editable: "Editable draft",
  submitted: "Submitted",
  correction_requested: "Correction requested",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

export function claimStatusLabel(
  status: NonNullable<Outputs["claims"]["getDraft"]>["status"],
): string {
  return statusLabels[status];
}

export function ClaimBand({
  title,
  status,
}: {
  title: string;
  status?: NonNullable<Outputs["claims"]["getDraft"]>["status"];
}) {
  return (
    <header>
      <Card variant="claim-band">
        <CardTitle as="h2">{title}</CardTitle>
        {status && (
          <Badge variant="claim-status">{claimStatusLabel(status)}</Badge>
        )}
      </Card>
    </header>
  );
}

export function PayoutAccountLines({
  account,
}: {
  account: { accountHolder: string; iban: string; bic: string | null };
}) {
  return (
    <dl className="grid min-w-0 grid-cols-[130px_minmax(0,1fr)] gap-x-5 gap-y-2 max-sm:grid-cols-1">
      <dt className="text-muted-foreground">Account holder</dt>
      <dd className="wrap-anywhere">{account.accountHolder}</dd>
      <dt className="text-muted-foreground">IBAN</dt>
      <dd className="font-mono wrap-anywhere tabular-nums select-all">
        {account.iban}
      </dd>
      {account.bic && (
        <>
          <dt className="text-muted-foreground">BIC</dt>
          <dd className="font-mono wrap-anywhere">{account.bic}</dd>
        </>
      )}
    </dl>
  );
}

export type ClaimCostRow = {
  id: string;
  transportProfile: string;
  amountEur: string;
  allocationMethod: string;
  allocations: ReactNode;
  documents: ReactNode;
  action?: ReactNode;
};

// Presentation only: callers retain the complete server list and all edit/download authority.
export function ClaimCostTable({
  rows,
  actions = false,
}: {
  rows: ClaimCostRow[];
  actions?: boolean;
}) {
  return (
    <Table variant="accounting">
      <TableCaption>
        Exact totals, Cost Allocations and linked Proof Documents.
      </TableCaption>
      <colgroup>
        <col className="w-[12%]" />
        <col className="w-[16%]" />
        <col className="w-[30%]" />
        <col className={actions ? "w-[28%]" : "w-[42%]"} />
        {actions && <col className="w-[14%]" />}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead variant="accounting" scope="col">
            Transport
          </TableHead>
          <TableHead variant="amount" scope="col">
            Total (EUR)
          </TableHead>
          <TableHead variant="accounting" scope="col">
            Cost Allocations
          </TableHead>
          <TableHead variant="accounting" scope="col">
            Proof Documents
          </TableHead>
          {actions && (
            <TableHead variant="accounting" scope="col">
              Action
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} id={`cost-${row.id}`}>
            <TableCell variant="accounting">{row.transportProfile}</TableCell>
            <TableCell variant="amount">{row.amountEur}</TableCell>
            <TableCell variant="accounting">
              <p className="mb-2 font-semibold">
                {row.allocationMethod === "amount"
                  ? "Amount (EUR)"
                  : row.allocationMethod === "percentage"
                    ? "Percentage"
                    : "Equal"}
              </p>
              {row.allocations}
            </TableCell>
            <TableCell variant="accounting">{row.documents}</TableCell>
            {actions && <TableCell variant="accounting">{row.action}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
