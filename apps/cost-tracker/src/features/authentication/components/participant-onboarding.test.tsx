import { ORPCError } from "@orpc/client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
} from "@/features/authentication/components/participant-onboarding";

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
const forbidden = (message: string) => new ORPCError("FORBIDDEN", { message });

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
    ["invitation", { kind: "invitation" as const, invitationId: "invite-1" }],
  ])("joins by %s and reaches the same dashboard", async (_name, source) => {
    const user = userEvent.setup();
    render(<ParticipantJoin agreement={published} source={source} />);
    await user.type(screen.getByLabelText("Full name"), "Alex Example");
    expect(screen.getByRole("button", { name: "Join Project" })).toBeDisabled();
    expect(screen.getByText(published.content)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /I accept/ }));
    await user.click(screen.getByRole("button", { name: "Join Project" }));
    await waitFor(() =>
      expect(mocks.join).toHaveBeenCalledWith({
        source,
        profile: { fullName: "Alex Example" },
        agreement: { accepted: true },
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/participant");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("never offers pending legal text as accept-worthy and does not call join", async () => {
    render(
      <ParticipantJoin
        agreement={pending}
        source={{ kind: "invitation", invitationId: "i" }}
      />,
    );
    expect(
      screen.getByText(/agreement is not yet available/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join Project" })).toBeDisabled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(mocks.join).not.toHaveBeenCalled();
  });

  it("keeps the join form available after a server refusal without leaking server messages", async () => {
    mocks.join.mockRejectedValue(new Error("internal secret detail"));
    const user = userEvent.setup();
    render(
      <ParticipantJoin
        agreement={published}
        source={{ kind: "link", id: "link-1", secret: "secret-1" }}
      />,
    );
    await user.type(screen.getByLabelText("Full name"), "Alex Example");
    await user.click(screen.getByRole("checkbox", { name: /I accept/ }));
    await user.click(screen.getByRole("button", { name: "Join Project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /server or network is unreachable/i,
    );
    expect(screen.queryByText("internal secret detail")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Join Project" }),
    ).not.toBeDisabled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("rejects incomplete Participant Registration Links before joining without internal wording", () => {
    render(<ParticipantJoin agreement={published} source={null} />);
    expect(
      screen.getByText(
        /complete Participant Invitation or Participant Registration Link required/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/secret|hash/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Join Project" }),
    ).not.toBeInTheDocument();
  });
});

describe("ParticipantDashboard", () => {
  it("lists only server-returned Participations and their Organizations, not memberships", async () => {
    render(<ParticipantDashboard agreement={published} />);
    expect(await screen.findByText("Workshop")).toBeInTheDocument();
    expect(screen.getByText(/Partner A/)).toBeInTheDocument();
    expect(screen.getByText(/Host B/)).toBeInTheDocument();
    expect(screen.queryByText("Other member Project")).not.toBeInTheDocument();
    expect(mocks.listMyProjects).toHaveBeenCalledOnce();
  });

  it("shows an empty state for users without Participations", async () => {
    mocks.listMyProjects.mockResolvedValue([]);
    render(<ParticipantDashboard agreement={published} />);
    expect(await screen.findByText(/No Projects yet/)).toBeInTheDocument();
  });

  it("blocks missing profiles until saved, then requests current agreement", async () => {
    mocks.listMyProjects
      .mockRejectedValueOnce(
        forbidden("Complete your Participant profile before accessing Projects."),
      )
      .mockRejectedValueOnce(
        forbidden(
          "Accept the current Participant agreement before accessing Projects.",
        ),
      )
      .mockResolvedValueOnce(projects);
    const user = userEvent.setup();
    render(<ParticipantDashboard agreement={published} />);
    expect(await screen.findByText(/Complete your profile/)).toBeInTheDocument();
    expect(screen.queryByText("Workshop")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Full name"), "Alex Example");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(
      await screen.findByText(/Accept the current agreement/),
    ).toBeInTheDocument();
    expect(mocks.saveProfile).toHaveBeenCalledWith({ fullName: "Alex Example" });
    await user.click(screen.getByRole("checkbox", { name: /I accept/ }));
    await user.click(screen.getByRole("button", { name: "Accept agreement" }));
    expect(await screen.findByText("Workshop")).toBeInTheDocument();
    expect(mocks.acceptAgreement).toHaveBeenCalledWith({ accepted: true });
  });

  it("blocks stale agreement until accepted", async () => {
    mocks.listMyProjects
      .mockRejectedValueOnce(
        forbidden(
          "Accept the current Participant agreement before accessing Projects.",
        ),
      )
      .mockResolvedValueOnce(projects);
    const user = userEvent.setup();
    render(<ParticipantDashboard agreement={published} />);
    expect(
      await screen.findByText(/Accept the current agreement/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Workshop")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /I accept/ }));
    await user.click(screen.getByRole("button", { name: "Accept agreement" }));
    expect(await screen.findByText("Workshop")).toBeInTheDocument();
  });

  it("explains pending publication and keeps Participant actions blocked", () => {
    render(<ParticipantDashboard agreement={pending} />);
    expect(
      screen.getByText(/agreement is not yet available/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Accept agreement" }),
    ).toBeDisabled();
    expect(mocks.listMyProjects).not.toHaveBeenCalled();
  });
});
