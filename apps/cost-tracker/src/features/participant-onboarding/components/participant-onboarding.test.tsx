import { ORPCError } from "@orpc/client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSituationErrors } from "@/lib/orpc/errors";

const mocks = vi.hoisted(() => ({
  join: vi.fn(),
  listMyProjects: vi.fn(),
  saveProfile: vi.fn(),
  acceptAgreement: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    participantOnboarding: {
      join: mocks.join,
      listMyProjects: mocks.listMyProjects,
      saveProfile: mocks.saveProfile,
      acceptAgreement: mocks.acceptAgreement,
    },
  },
}));

import {
  ParticipantDashboard,
  ParticipantJoin,
} from "@/features/participant-onboarding/components/participant-onboarding";

const published = {
  id: "fixture-v1",
  contentHash: "fixture-hash",
  content: "Fixture agreement terms for tests only.",
};
const pending = { id: "PENDING-LEGAL-001", contentHash: "" };
const projects = [
  {
    participationId: "participation-1",
    projectId: "project-1",
    projectName: "Workshop",
    representedOrganizationName: "Partner A",
    hostingOrganizationName: "Host B",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listMyProjects.mockResolvedValue(projects);
  mocks.join.mockResolvedValue({ participationId: "participation-1" });
  mocks.saveProfile.mockResolvedValue({ success: true });
  mocks.acceptAgreement.mockResolvedValue({ version: "fixture-v1" });
});

describe("ParticipantJoin", () => {
  it.each([
    ["link", { kind: "link" as const, id: "link-1", secret: "secret-1" }],
    [
      "invitation",
      {
        kind: "invitation" as const,
        invitationId: "invite-1",
        secret: "secret-1",
      },
    ],
  ])("joins by %s and reaches the same dashboard", async (_name, source) => {
    const user = userEvent.setup();
    render(<ParticipantJoin agreement={published} source={source} />);
    await user.type(screen.getByTestId("participant-name"), "Alex Example");
    await user.selectOptions(screen.getByTestId("participant-country"), "DE");
    expect(screen.getByTestId("join-project")).toBeDisabled();
    expect(screen.getByTestId("participant-agreement")).toBeInTheDocument();
    await user.click(screen.getByTestId("accept-participant-agreement"));
    await user.click(screen.getByTestId("join-project"));
    await waitFor(() =>
      expect(mocks.join).toHaveBeenCalledWith({
        source,
        profile: { fullName: "Alex Example", country: "DE" },
        agreement: { accepted: true },
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/participant");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("requires an EU country before joining", async () => {
    const user = userEvent.setup();
    render(
      <ParticipantJoin
        agreement={published}
        source={{ kind: "link", id: "link-1", secret: "secret-1" }}
      />,
    );
    await user.type(screen.getByTestId("participant-name"), "Alex Example");
    await user.click(screen.getByTestId("accept-participant-agreement"));
    expect(screen.getByTestId("join-project")).toBeDisabled();
    await user.selectOptions(screen.getByTestId("participant-country"), "FR");
    await user.click(screen.getByTestId("join-project"));
    await waitFor(() =>
      expect(mocks.join).toHaveBeenCalledWith({
        source: { kind: "link", id: "link-1", secret: "secret-1" },
        profile: { fullName: "Alex Example", country: "FR" },
        agreement: { accepted: true },
      }),
    );
  });

  it("never offers pending legal text as accept-worthy and does not call join", async () => {
    render(
      <ParticipantJoin
        agreement={pending}
        source={{ kind: "invitation", invitationId: "i", secret: "s" }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-agreement-state",
      "unavailable",
    );
    expect(screen.getByTestId("join-project")).toBeDisabled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(mocks.join).not.toHaveBeenCalled();
  });

  it("keeps the join form and its values available after a server refusal", async () => {
    mocks.join.mockRejectedValue(new Error("internal secret detail"));
    const user = userEvent.setup();
    render(
      <ParticipantJoin
        agreement={published}
        source={{ kind: "link", id: "link-1", secret: "secret-1" }}
      />,
    );
    await user.type(screen.getByTestId("participant-name"), "Alex Example");
    await user.selectOptions(screen.getByTestId("participant-country"), "DE");
    await user.click(screen.getByTestId("accept-participant-agreement"));
    await user.click(screen.getByTestId("join-project"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("participant-name")).toHaveValue("Alex Example");
    expect(screen.getByTestId("participant-country")).toHaveValue("DE");
    expect(mocks.join).toHaveBeenCalledWith({
      source: { kind: "link", id: "link-1", secret: "secret-1" },
      profile: { fullName: "Alex Example", country: "DE" },
      agreement: { accepted: true },
    });
    expect(screen.getByTestId("join-project")).not.toBeDisabled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("rejects incomplete Participant Registration Links before joining", () => {
    render(<ParticipantJoin agreement={published} source={null} />);
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-entry-state",
      "incomplete",
    );
    expect(screen.queryByTestId("participant-name")).not.toBeInTheDocument();
    expect(mocks.join).not.toHaveBeenCalled();
    expect(screen.queryByTestId("join-project")).not.toBeInTheDocument();
  });
});

describe("ParticipantDashboard", () => {
  it("lists only server-returned Participations with represented and Hosting Organization slots", async () => {
    render(<ParticipantDashboard agreement={published} />);
    const project = await screen.findByTestId("participant-project-project-1");
    expect(project).toHaveAttribute("data-participation-id", "participation-1");
    expect(
      project.querySelector('[data-organization-role="represented"]'),
    ).toBeInTheDocument();
    expect(
      project.querySelector('[data-organization-role="hosting"]'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByTestId("participant-dashboard")).toHaveAttribute(
      "data-dashboard-state",
      "ready",
    );
    expect(screen.getByTestId("participant-dashboard")).toHaveAttribute(
      "data-project-count",
      "1",
    );
    expect(mocks.listMyProjects).toHaveBeenCalledOnce();
  });

  it("shows an empty state for users without Participations", async () => {
    mocks.listMyProjects.mockResolvedValue([]);
    render(<ParticipantDashboard agreement={published} />);
    await waitFor(() =>
      expect(screen.getByTestId("participant-dashboard")).toHaveAttribute(
        "data-dashboard-state",
        "ready",
      ),
    );
    expect(screen.getByTestId("participant-dashboard")).toHaveAttribute(
      "data-project-count",
      "0",
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("blocks missing profiles until saved, then requests current agreement", async () => {
    mocks.listMyProjects
      .mockRejectedValueOnce(createSituationErrors().incompleteProfile())
      .mockRejectedValueOnce(createSituationErrors().agreementRequired())
      .mockResolvedValueOnce(projects);
    const user = userEvent.setup();
    render(<ParticipantDashboard agreement={published} />);
    expect(
      await screen.findByTestId("participant-profile-name"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("participant-dashboard")).toHaveAttribute(
      "data-dashboard-state",
      "profile",
    );
    expect(
      screen.queryByTestId("participant-project-project-1"),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByTestId("participant-profile-name"),
      "Alex Example",
    );
    await user.click(screen.getByTestId("save-participant-profile"));
    expect(await screen.findByTestId("accept-agreement")).toBeDisabled();
    expect(screen.getByTestId("participant-dashboard")).toHaveAttribute(
      "data-dashboard-state",
      "agreement",
    );
    expect(mocks.saveProfile).toHaveBeenCalledWith({ fullName: "Alex Example" });
    await user.click(screen.getByTestId("accept-participant-agreement"));
    await user.click(screen.getByTestId("accept-agreement"));
    expect(
      await screen.findByTestId("participant-project-project-1"),
    ).toHaveAttribute("data-participation-id", "participation-1");
    expect(screen.getByTestId("participant-dashboard")).toHaveAttribute(
      "data-dashboard-state",
      "ready",
    );
    expect(mocks.acceptAgreement).toHaveBeenCalledWith({ accepted: true });
  });

  it("does not activate profile completion from prose or wrong code/reason", async () => {
    mocks.listMyProjects.mockRejectedValue(
      new ORPCError("FORBIDDEN", {
        message: "Complete your Participant profile before accessing Projects.",
        data: { reason: "PARTICIPANT_PROFILE_REQUIRED" },
      }),
    );
    render(<ParticipantDashboard agreement={published} />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("participant-dashboard")).toHaveAttribute(
      "data-dashboard-state",
      "error",
    );
    expect(screen.getByTestId("retry-participant-projects")).toBeEnabled();
    expect(
      screen.queryByTestId("participant-profile-name"),
    ).not.toBeInTheDocument();
  });

  it("blocks stale agreement until accepted", async () => {
    mocks.listMyProjects
      .mockRejectedValueOnce(createSituationErrors().agreementRequired())
      .mockResolvedValueOnce(projects);
    const user = userEvent.setup();
    render(<ParticipantDashboard agreement={published} />);
    expect(await screen.findByTestId("accept-agreement")).toBeDisabled();
    expect(screen.getByTestId("participant-dashboard")).toHaveAttribute(
      "data-dashboard-state",
      "agreement",
    );
    expect(
      screen.queryByTestId("participant-project-project-1"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByTestId("accept-participant-agreement"));
    await user.click(screen.getByTestId("accept-agreement"));
    expect(
      await screen.findByTestId("participant-project-project-1"),
    ).toHaveAttribute("data-participation-id", "participation-1");
    expect(screen.getByTestId("participant-dashboard")).toHaveAttribute(
      "data-dashboard-state",
      "ready",
    );
  });

  it("explains pending publication and keeps Participant actions blocked", () => {
    render(<ParticipantDashboard agreement={pending} />);
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-agreement-state",
      "unavailable",
    );
    expect(screen.getByTestId("accept-agreement")).toBeDisabled();
    expect(mocks.listMyProjects).not.toHaveBeenCalled();
  });
});
