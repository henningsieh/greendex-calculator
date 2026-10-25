import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  report: {} as Record<string, unknown>,
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    participations: {
      listHostedReport: {
        queryOptions: ({ input }: { input: { projectId: string } }) => ({
          queryKey: ["participants-report", input.projectId],
          queryFn: async () => mocks.report,
        }),
      },
    },
  },
}));

import { HostedParticipantReport } from "@/features/projects/components/hosted-participant-report";

const participant = (name: string, agreement: "completed" | "pending") => ({
  id: `participation-${name}`,
  displayName: name,
  email: `${name.toLowerCase()}@example.org`,
  country: null,
  agreement,
});

function renderReport() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading report</p>}>
        <HostedParticipantReport projectId="project-1" />
      </Suspense>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.report = {
    projectId: "project-1",
    agreement: { versionId: "fixture-v1", published: true },
    organizations: [
      {
        id: "org-alpha",
        name: "Alpha Mobility",
        country: "FR",
        participantCount: 2,
        completedCount: 1,
        pendingCount: 1,
        participants: [
          participant("Zoe", "completed"),
          participant("Amy", "pending"),
        ],
      },
    ],
  };
});

describe("Hosting Participant view", { timeout: 20_000 }, () => {
  it("groups totals by Partner Organization and hides Participants until expanded", async () => {
    renderReport();

    const report = await screen.findByTestId(
      "hosted-participant-report",
      {},
      {
        timeout: 10_000,
      },
    );
    expect(report).toHaveAttribute("data-agreement-published", "true");
    expect(
      within(report).queryByTestId("unpublished-agreement"),
    ).not.toBeInTheDocument();
    const organization = within(report).getByTestId(
      "report-organization-org-alpha",
    );
    expect(organization.querySelector("[data-country]")).toHaveAttribute(
      "data-country",
      "FR",
    );
    expect(
      organization.querySelector("[data-participant-count]"),
    ).toHaveAttribute("data-participant-count", "2");
    expect(organization.querySelector("[data-completed-count]")).toHaveAttribute(
      "data-completed-count",
      "1",
    );
    expect(organization.querySelector("[data-pending-count]")).toHaveAttribute(
      "data-pending-count",
      "1",
    );
    expect(within(organization).queryByRole("list")).not.toBeInTheDocument();

    const toggle = within(organization).getByTestId("toggle-report-participants");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "participants-org-alpha");
    await userEvent.click(toggle);

    const expandedToggle = await screen.findByTestId(
      "toggle-report-participants",
    );
    expect(expandedToggle).toHaveAttribute("aria-expanded", "true");
    expect(within(organization).getByRole("list")).toHaveAttribute(
      "id",
      "participants-org-alpha",
    );
    expect(within(organization).getAllByRole("listitem")).toHaveLength(2);
    const completed = within(organization).getByTestId(
      "report-participant-participation-Zoe",
    );
    const pending = within(organization).getByTestId(
      "report-participant-participation-Amy",
    );
    expect(completed.querySelector("[data-agreement-status]")).toHaveAttribute(
      "data-agreement-status",
      "completed",
    );
    expect(pending.querySelector("[data-agreement-status]")).toHaveAttribute(
      "data-agreement-status",
      "pending",
    );

    await userEvent.click(expandedToggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(organization).queryByRole("list")).not.toBeInTheDocument();
  });

  it("offers no Participant control beyond expanding", async () => {
    renderReport();

    const report = await screen.findByTestId(
      "hosted-participant-report",
      {},
      {
        timeout: 10_000,
      },
    );
    await userEvent.click(
      within(report).getByTestId("toggle-report-participants"),
    );

    expect(within(report).getAllByRole("button")).toHaveLength(1);
    expect(
      within(report).getByTestId("toggle-report-participants"),
    ).toHaveAttribute("aria-expanded", "true");
    expect(within(report).queryAllByRole("link")).toHaveLength(0);
  });

  it("reports an empty Project without inventing Invitees", async () => {
    mocks.report = {
      projectId: "project-1",
      agreement: { versionId: "fixture-v1", published: true },
      organizations: [],
    };
    renderReport();

    const report = await screen.findByTestId("hosted-participant-report");
    expect(report.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(within(report).queryAllByRole("button")).toHaveLength(0);
    expect(within(report).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("flags an unpublished required agreement without hiding joined Participants", async () => {
    mocks.report = {
      ...(mocks.report as Record<string, unknown>),
      agreement: { versionId: "PENDING-v2", published: false },
    };
    renderReport();

    const report = await screen.findByTestId("hosted-participant-report");
    expect(report).toHaveAttribute("data-agreement-published", "false");
    expect(
      within(report).getByTestId("unpublished-agreement"),
    ).toBeInTheDocument();
    expect(
      within(report).getByTestId("toggle-report-participants"),
    ).toBeEnabled();
  });
});
