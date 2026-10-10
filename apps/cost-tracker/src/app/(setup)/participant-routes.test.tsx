import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));
vi.mock("@/lib/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/features/authentication/components/participant-onboarding", () => ({
  ParticipantJoin: ({ source }: { source: unknown }) => (
    <p>Join: {JSON.stringify(source)}</p>
  ),
  ParticipantDashboard: () => <p>My Participations</p>,
}));

import ParticipantInvitationPage from "@/app/(setup)/participant-invitations/[invitationId]/page";
import ParticipantLinkPage from "@/app/(setup)/participant-links/[id]/page";
import ParticipantPage from "@/app/(setup)/participant/page";

describe("Participant routes", () => {
  it("lets signed-in, Organization-less recipients open registration links", async () => {
    render(
      await ParticipantLinkPage({
        params: Promise.resolve({ id: "link-1" }),
        searchParams: Promise.resolve({ secret: "secret-1" }),
      }),
    );
    expect(
      screen.getByText('Join: {"kind":"link","id":"link-1","secret":"secret-1"}'),
    ).toBeInTheDocument();
    expect(mocks.requireSession).toHaveBeenCalled();
  });
  it("rejects ambiguous secrets", async () => {
    render(
      await ParticipantLinkPage({
        params: Promise.resolve({ id: "link-1" }),
        searchParams: Promise.resolve({ secret: ["one", "two"] }),
      }),
    );
    expect(screen.getByText("Join: null")).toBeInTheDocument();
  });
  it("lets signed-in, Organization-less recipients open invitations", async () => {
    render(
      await ParticipantInvitationPage({
        params: Promise.resolve({ invitationId: "invite-1" }),
        searchParams: Promise.resolve({ secret: "secret-1" }),
      }),
    );
    expect(
      screen.getByText(
        'Join: {"kind":"invitation","invitationId":"invite-1","secret":"secret-1"}',
      ),
    ).toBeInTheDocument();
  });
  it("rejects ambiguous invitation secrets", async () => {
    render(
      await ParticipantInvitationPage({
        params: Promise.resolve({ invitationId: "invite-1" }),
        searchParams: Promise.resolve({ secret: ["one", "two"] }),
      }),
    );
    expect(screen.getByText("Join: null")).toBeInTheDocument();
  });
  it("offers the same dashboard regardless of the join path", async () => {
    render(await ParticipantPage());
    expect(screen.getByText("My Participations")).toBeInTheDocument();
  });
});
