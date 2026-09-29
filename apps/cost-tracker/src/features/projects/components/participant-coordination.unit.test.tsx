import { ORPCError } from "@orpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/tanstack-react-query/client";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  searchOnboarded: vi.fn(),
  update: vi.fn(),
  issueInvitation: vi.fn(),
  reissueInvitation: vi.fn(),
  createRegistrationLink: vi.fn(),
  setInvitationOpen: vi.fn(),
  setRegistrationLinkOpen: vi.fn(),
}));

vi.mock("@/lib/orpc/orpc", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/orpc/orpc")>();
  return {
    ...original,
    orpc: {
      participantOnboarding: {
        issueInvitation: mocks.issueInvitation,
        reissueInvitation: mocks.reissueInvitation,
        createRegistrationLink: mocks.createRegistrationLink,
        setInvitationOpen: mocks.setInvitationOpen,
        setRegistrationLinkOpen: mocks.setRegistrationLinkOpen,
      },
      participations: {
        create: mocks.create,
        searchOnboarded: mocks.searchOnboarded,
        update: mocks.update,
      },
    },
    orpcQuery: {
      participations: {
        listPartnership: {
          queryKey: (
            ...args: Parameters<
              typeof original.orpcQuery.participations.listPartnership.queryKey
            >
          ) =>
            original.orpcQuery.participations.listPartnership.queryKey(...args),
          queryOptions: (
            ...args: Parameters<
              typeof original.orpcQuery.participations.listPartnership.queryOptions
            >
          ) => ({
            ...original.orpcQuery.participations.listPartnership.queryOptions(
              ...args,
            ),
            queryFn: mocks.list,
          }),
        },
      },
    },
  };
});

vi.mock("@/components/ui/popover", async () => {
  const { createContext, useContext, cloneElement } = await import("react");
  const Context = createContext({
    open: false,
    onOpenChange: (_open: boolean) => {},
  });
  return {
    Popover: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) => (
      <Context.Provider value={{ open, onOpenChange }}>
        {children}
      </Context.Provider>
    ),
    PopoverTrigger: ({ render }: { render: React.ReactElement }) => {
      const { onOpenChange } = useContext(Context);
      return cloneElement(render as React.ReactElement<{ onClick: () => void }>, {
        onClick: () => onOpenChange(true),
      });
    },
    PopoverContent: ({ children }: { children: React.ReactNode }) =>
      useContext(Context).open ? <div>{children}</div> : null,
  };
});

import { ParticipantCoordination } from "@/features/projects/components/participant-coordination";
import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { orpcQuery } from "@/lib/orpc/orpc";

async function renderCoordination() {
  const client = createQueryClient();
  await client.query(
    orpcQuery.participations.listPartnership.queryOptions({
      input: { partnershipId: "own-partnership" },
      meta: { costTrackerORPC: true },
    }),
  );
  render(
    <QueryClientProvider client={client}>
      <ParticipantCoordination partnershipId="own-partnership" />
    </QueryClientProvider>,
  );
}

async function selectOnboardedParticipant(
  user: ReturnType<typeof userEvent.setup>,
  id: string,
  name: string,
) {
  await user.click(screen.getByRole("button", { name: "Onboarded Participant" }));
  await user.type(
    screen.getByLabelText("Search Onboarded Participant by name, email or ID"),
    id,
  );
  await waitFor(() =>
    expect(mocks.searchOnboarded).toHaveBeenCalledWith({
      partnershipId: "own-partnership",
      search: id,
    }),
  );
  await user.click(await screen.findByText(name));
}

describe("ParticipantCoordination", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
    mocks.list.mockReset().mockResolvedValue({
      participations: [
        {
          id: "person-1",
          projectId: "project-1",
          representedOrganizationId: "partner-1",
          displayName: "Own Person",
          email: "own@example.org",
          userId: "user-1",
          country: null,
        },
      ],
      invitations: [
        {
          invitationId: "invite-1",
          email: "pending@example.org",
          status: "pending",
        },
      ],
      registrationLinks: [{ id: "link-1", enabled: true }],
    });
    mocks.create.mockReset();
    mocks.searchOnboarded.mockReset().mockResolvedValue([
      { id: "user-existing", name: "Existing Candidate" },
      { id: "host-user", name: "Host Candidate" },
    ]);
    mocks.update.mockReset();
    mocks.issueInvitation
      .mockReset()
      .mockResolvedValue({ invitationId: "invite-2", delivery: "sent" });
    mocks.reissueInvitation
      .mockReset()
      .mockResolvedValue({ invitationId: "invite-3", delivery: "failed" });
    mocks.createRegistrationLink
      .mockReset()
      .mockResolvedValue({ id: "new-link", secret: "one-time-secret" });
    mocks.setInvitationOpen.mockReset().mockResolvedValue({ open: false });
    mocks.setRegistrationLinkOpen.mockReset().mockResolvedValue({ open: false });
  });

  it("renders only the server-scoped Partnership response with honest joined and invitation states", async () => {
    await renderCoordination();
    expect(mocks.list).toHaveBeenCalledOnce();
    expect(screen.getByText("Own Person")).toBeTruthy();
    expect(screen.getByText("Joined")).toBeTruthy();
    expect(screen.getByText("pending@example.org")).toBeTruthy();
    expect(screen.getByText("Invitation pending")).toBeTruthy();
    expect(screen.queryByText("Other Partnership Person")).toBeNull();
  });

  it("does not render a foreign Partnership when the server denies the list", async () => {
    mocks.list.mockRejectedValue(new ORPCError("FORBIDDEN"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const client = createQueryClient();
    client.setDefaultOptions({ queries: { retry: false } });
    render(
      <QueryClientProvider client={client}>
        <ProjectDataErrorBoundary resource="Partnership Participants">
          <Suspense fallback={<p>Loading Participants</p>}>
            <ParticipantCoordination partnershipId="foreign-partnership" />
          </Suspense>
        </ProjectDataErrorBoundary>
      </QueryClientProvider>,
    );
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("You do not have permission");
    expect(screen.queryByText("Own Person")).toBeNull();
    expect(screen.queryByText("Other Partnership Person")).toBeNull();
    consoleError.mockRestore();
  });

  it("surfaces an actionable review request only for the exact known duplicate response", async () => {
    mocks.create.mockRejectedValue(
      new ORPCError("BAD_REQUEST", {
        message:
          "Identity already participates in this Project; request merge review.",
      }),
    );
    const user = userEvent.setup();
    await renderCoordination();
    await selectOnboardedParticipant(user, "user-existing", "Existing Candidate");
    await user.click(screen.getByRole("button", { name: "Add Participation" }));
    expect(mocks.create).toHaveBeenCalledWith({
      partnershipId: "own-partnership",
      userId: "user-existing",
    });
    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain("Review request");
    expect(notice.textContent).toContain("contact the Hosting Organization");
    expect(notice.textContent).not.toContain("Identity already participates");
  });

  it("does not treat an arbitrary BAD_REQUEST as a duplicate or expose remote text", async () => {
    mocks.create.mockRejectedValue(
      new ORPCError("BAD_REQUEST", { message: "database secret" }),
    );
    const user = userEvent.setup();
    await renderCoordination();
    await selectOnboardedParticipant(user, "user-existing", "Existing Candidate");
    await user.click(screen.getByRole("button", { name: "Add Participation" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Check your details",
      ),
    );
    expect(screen.queryByText("database secret")).toBeNull();
  });

  it("shows access denied when the server forbids a Partner-side write", async () => {
    mocks.create.mockRejectedValue(
      new ORPCError("FORBIDDEN", { message: "private role details" }),
    );
    const user = userEvent.setup();
    await renderCoordination();
    await selectOnboardedParticipant(user, "host-user", "Host Candidate");
    await user.click(screen.getByRole("button", { name: "Add Participation" }));
    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain("Access denied");
    expect(notice.textContent).toContain("You do not have permission");
    expect(notice.textContent).not.toContain("private role details");
  });

  it("issues email invitations and distinguishes already-issued from delivery failure", async () => {
    mocks.issueInvitation.mockResolvedValue({
      invitationId: "invite-1",
      delivery: "already-issued",
    });
    const user = userEvent.setup();
    await renderCoordination();
    await user.type(screen.getByLabelText("Invitee email"), "new@example.org");
    await user.click(
      screen.getByRole("button", { name: "Send Participant Invitation" }),
    );
    await waitFor(() =>
      expect(mocks.issueInvitation).toHaveBeenCalledWith({
        partnershipId: "own-partnership",
        email: "new@example.org",
      }),
    );
    expect(
      (await screen.findByText("Invitation already issued")).textContent,
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", {
        name: "Reissue invitation for pending@example.org",
      }),
    );
    await waitFor(() =>
      expect(mocks.reissueInvitation).toHaveBeenCalledWith({
        partnershipId: "own-partnership",
        email: "pending@example.org",
      }),
    );
    expect(await screen.findByText("Email delivery failed")).toBeTruthy();
  });

  it("shows a new secret URL only on creation and closes listed entry points", async () => {
    const user = userEvent.setup();
    await renderCoordination();
    await user.click(
      screen.getByRole("button", {
        name: "Create Participant Registration Link",
      }),
    );
    expect(mocks.createRegistrationLink).toHaveBeenCalledWith({
      partnershipId: "own-partnership",
    });
    expect(
      (
        (await screen.findByLabelText(
          "New registration link (copy now)",
        )) as HTMLInputElement
      ).value,
    ).toContain("/participant-links/new-link?secret=one-time-secret");
    await user.click(
      screen.getByRole("button", {
        name: "Close invitation for pending@example.org",
      }),
    );
    await waitFor(() =>
      expect(mocks.setInvitationOpen).toHaveBeenCalledWith({
        invitationId: "invite-1",
        open: false,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Close registration link link-1" }),
    );
    await waitFor(() =>
      expect(mocks.setRegistrationLinkOpen).toHaveBeenCalledWith({
        id: "link-1",
        open: false,
      }),
    );
  });

  it("keeps the previous link URL when creation fails", async () => {
    const user = userEvent.setup();
    await renderCoordination();
    await user.click(
      screen.getByRole("button", {
        name: "Create Participant Registration Link",
      }),
    );
    expect(
      (
        (await screen.findByLabelText(
          "New registration link (copy now)",
        )) as HTMLInputElement
      ).value,
    ).toContain("/participant-links/new-link?secret=one-time-secret");
    mocks.createRegistrationLink.mockRejectedValueOnce(
      new ORPCError("FORBIDDEN"),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Create Participant Registration Link",
      }),
    );
    await screen.findByText("Entry point unavailable");
    expect(
      (
        screen.getByLabelText(
          "New registration link (copy now)",
        ) as HTMLInputElement
      ).value,
    ).toContain("/participant-links/new-link?secret=one-time-secret");
  });

  it("edits only the scoped Participation using the server mutation", async () => {
    mocks.update.mockResolvedValue({});
    const user = userEvent.setup();
    await renderCoordination();
    await user.selectOptions(
      screen.getByLabelText("Country for Own Person"),
      "DE",
    );
    await user.click(
      screen.getByRole("button", { name: "Save country for Own Person" }),
    );
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        partnershipId: "own-partnership",
        id: "person-1",
        country: "DE",
      }),
    );
  });
});
