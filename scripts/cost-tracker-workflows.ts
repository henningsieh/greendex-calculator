import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  claimTransitions,
  settledClaimStatuses,
} from "../apps/cost-tracker/src/features/claims/claim-lifecycle";
import { paymentTransitions } from "../apps/cost-tracker/src/features/claims/payment-interaction";
import { projectTransitions } from "../apps/cost-tracker/src/features/projects/project-lifecycle";
import { PROJECT_STATUSES } from "../apps/cost-tracker/src/features/projects/validation-schemas";

const guards = {
  payoutAccount: "Payout Account selected",
  submissionReady: "submission checklist passes",
  reason: "reason required",
  fullPayment: "one actual transfer of the full approved amount",
  paymentConfirmationReady:
    "approved amount available or correction reason supplied",
  settled: "all Project Partnerships settled",
};

function diagram(
  title: string,
  edges: readonly {
    from: string | null;
    to: string;
    event: string;
    guard?: keyof typeof guards | null;
  }[],
) {
  return [
    `# ${title}`,
    "",
    "```mermaid",
    "stateDiagram-v2",
    ...edges.map(
      ({ from, to, event, guard }) =>
        `    ${from ?? "[*]"} --> ${to}: ${event}${guard ? ` (${guards[guard]})` : ""}`,
    ),
    "```",
    "",
  ].join("\n");
}

function projectStatusProjection() {
  const ordered = PROJECT_STATUSES.map((status) => `\`${status}\``).join(" → ");
  const settled = settledClaimStatuses
    .map((status) => `\`${status}\``)
    .join(" or ");
  return [
    "## Derived list status",
    "",
    "`status` is a read-only projection over the Project archive flag and the Claim settled rule. It is not a state machine.",
    "",
    "- `archived` when the Project is archived.",
    "- `ready` when the Project is active and every Project Partnership has a settled Claim.",
    "- `open` when the Project is active and at least one Project Partnership has no settled Claim.",
    "",
    `A Claim is settled when it is ${settled}. Status sort rank follows ${ordered}.`,
    "",
  ].join("\n");
}

const documents = {
  "claim-lifecycle.generated.md": diagram(
    "Claim lifecycle",
    Object.entries(claimTransitions).map(([event, { from, to, guard }]) => ({
      event,
      from,
      to,
      guard,
    })),
  ),
  "payment-confirmation.generated.md": diagram(
    "Payment confirmation",
    paymentTransitions.map((edge) => ({
      ...edge,
      event:
        edge.event === "open"
          ? "open payment or paid-flag correction"
          : edge.event,
    })),
  ),
  "project-lifecycle.generated.md": `${diagram(
    "Cost Tracker Project lifecycle",
    Object.entries(projectTransitions).map(([event, transition]) => ({
      ...transition,
      event: event === "archive" ? "confirm archive" : event,
    })),
  )}\n${projectStatusProjection()}`,
};

for (const [name, expected] of Object.entries(documents)) {
  const file = new URL(`../apps/cost-tracker/docs/${name}`, import.meta.url);
  if (process.argv.includes("--write")) {
    writeFileSync(file, expected);
  } else if (!existsSync(file) || readFileSync(file, "utf8") !== expected) {
    console.error(
      `${name} is missing or stale. Run pnpm run generate:cost-tracker-workflows.`,
    );
    process.exitCode = 1;
  }
}
