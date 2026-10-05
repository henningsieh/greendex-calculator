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

describe("Hosting Participant report", { timeout: 20_000 }, () => {
  it("groups totals by Partner Organization and hides Participants until expanded", async () => {
    renderReport();

    const report = await screen.findByRole(
      "region",
      { name: "Participants report" },
      { timeout: 10_000 },
    );
    expect(within(report).getByText("Alpha Mobility")).toBeTruthy();
    expect(within(report).getByText("Country: FR")).toBeTruthy();
    expect(within(report).getByText("2 Participants")).toBeTruthy();
    expect(within(report).getByText("1 completed")).toBeTruthy();
    expect(within(report).getByText("1 pending")).toBeTruthy();
    expect(within(report).queryByText("Zoe")).toBeNull();

    const toggle = within(report).getByRole("button", {
      name: "Show 2 Participants",
    });
    await userEvent.click(toggle);

    const toggleName = await screen.findByRole("button", {
      name: "Hide 2 Participants",
    });
    expect(toggleName.getAttribute("aria-expanded")).toBe("true");
    expect(within(report).getByText("Zoe")).toBeTruthy();
    expect(within(report).getByText("Agreement completed")).toBeTruthy();
    expect(within(report).getByText("Agreement pending")).toBeTruthy();
    expect(within(report).getByText("amy@example.org")).toBeTruthy();
  });

  it("offers no Participant control beyond expanding", async () => {
    renderReport();

    const report = await screen.findByRole(
      "region",
      { name: "Participants report" },
      { timeout: 10_000 },
    );
    await userEvent.click(
      within(report).getByRole("button", { name: "Show 2 Participants" }),
    );

    expect(
      within(report).queryByRole("button", { name: /remove|invite|edit/i }),
    ).toBeNull();
    expect(within(report).queryAllByRole("link")).toHaveLength(0);
  });

  it("reports an empty Project without inventing Invitees", async () => {
    mocks.report = {
      projectId: "project-1",
      agreement: { versionId: "fixture-v1", published: true },
      organizations: [],
    };
    renderReport();

    expect(
      await screen.findByText(
        "No Project Participations have joined this Project yet.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/not counted, so this is\s+not a pre-join funnel/),
    ).toBeTruthy();
  });

  it("counts nothing as completed while the required agreement is unpublished", async () => {
    mocks.report = {
      ...(mocks.report as Record<string, unknown>),
      agreement: { versionId: "PENDING-v2", published: false },
    };
    renderReport();

    expect(
      await screen.findByText(/Agreement version PENDING-v2 is not published/),
    ).toBeTruthy();
  });
});
