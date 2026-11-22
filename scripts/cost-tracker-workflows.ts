import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { claimTransitions } from "../apps/cost-tracker/src/features/claims/claim-lifecycle";
import { paymentTransitions } from "../apps/cost-tracker/src/features/claims/payment-interaction";
import { projectTransitions } from "../apps/cost-tracker/src/features/projects/project-lifecycle";

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
  "project-lifecycle.generated.md": diagram(
    "Cost Tracker Project lifecycle",
    Object.entries(projectTransitions).map(([event, transition]) => ({
      ...transition,
      event: event === "archive" ? "confirm archive" : event,
    })),
  ),
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
