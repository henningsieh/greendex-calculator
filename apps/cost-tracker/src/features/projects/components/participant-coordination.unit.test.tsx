import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
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
  remove: vi.fn(),
  issueInvitation: vi.fn(),
  reissueInvitation: vi.fn(),
  createRegistrationLink: vi.fn(),
  setInvitationOpen: vi.fn(),
  setRegistrationLinkOpen: vi.fn(),
}));

const browserSession = vi.hoisted(() => ({
  userId: "user-1",
  activeOrganizationId: "partner-1" as string | null,
  role: null as string | null,
}));

vi.mock("@/lib/auth-client", async () => {
  const { costTrackerOrganizationRoles, parseOrganizationRoles } =
    await import("@greendex/auth/permissions");
  return {
    authClient: {
      useSession: () => ({ data: { user: { id: browserSession.userId } } }),
      useActiveOrganization: () => ({
        data: browserSession.activeOrganizationId
          ? {
              id: browserSession.activeOrganizationId,
              members: [
                { userId: browserSession.userId, role: browserSession.role },
              ],
            }
          : null,
      }),
      // Resolves the identical single-sourced role definitions Better Auth uses.
      organization: {
        checkRolePermission: ({
          role,
          permissions,
        }: {
          role: string;
          permissions: Record<string, string[]>;
        }) =>
          parseOrganizationRoles(role).some(
            (name) =>
              name in costTrackerOrganizationRoles &&
              costTrackerOrganizationRoles[
                name as keyof typeof costTrackerOrganizationRoles
              ].authorize(permissions as never).success,
          ),
      },
    },
  };
});

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
        remove: mocks.remove,
      },
    },
    orpcQuery: {
      duplicateReviews: {
        list: {
          queryOptions: (
            ...args: Parameters<
              typeof original.orpcQuery.duplicateReviews.list.queryOptions
            >
          ) => ({
            ...original.orpcQuery.duplicateReviews.list.queryOptions(...args),
            queryFn: async () => [
              {
                id: "review-open",
                partnershipId: "own-partnership",
                candidateEmail: "review@example.org",
                status: "open",
                existingParticipationId: "person-1",
                decision: null,
              },
              {
                id: "review-assigned",
                partnershipId: "own-partnership",
                candidateEmail: "assigned@example.org",
                status: "assigned",
                existingParticipationId: "person-1",
                assignedToUserId: "user-1",
                decision: null,
              },
            ],
          }),
        },
      },
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

async function selectRegisteredUser(
  user: ReturnType<typeof userEvent.setup>,
  id: string,
  name: string,
) {
  await user.click(screen.getByRole("button", { name: "Registered User" }));
  await user.type(
    screen.getByLabelText("Search Registered User by name, email or ID"),
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
    browserSession.userId = "user-1";
    browserSession.activeOrganizationId = "partner-1";
    browserSession.role = ORGANIZATION_ROLES.OrganizationOwner;
    mocks.list.mockReset().mockResolvedValue({
      projectName: "Own Project",
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
      entryContext: {
        partnerOrganizationId: "partner-1",
        hostOrganizationId: "host-1",
        assignedCoordinator: false,
      },
    });
    mocks.create.mockReset();
    mocks.searchOnboarded.mockReset().mockResolvedValue([
      { id: "user-existing", name: "Existing Candidate" },
      { id: "host-user", name: "Host Candidate" },
    ]);
    mocks.remove.mockReset();
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
    expect(screen.getByText("1 Participant in Own Project")).toBeTruthy();
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
        <ProjectDataErrorBoundary resource="Project Participations">
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

  it("surfaces an actionable review request only for a validated duplicate reason", async () => {
    mocks.create.mockRejectedValue(
      new ORPCError("BAD_REQUEST", {
        message: "hostile remote text",
        data: { reason: "PARTICIPATION_DUPLICATE" },
      }),
    );
    const user = userEvent.setup();
    await renderCoordination();
    await selectRegisteredUser(user, "user-existing", "Existing Candidate");
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
    await selectRegisteredUser(user, "user-existing", "Existing Candidate");
    await user.click(screen.getByRole("button", { name: "Add Participation" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Check your details",
      ),
    );
    expect(screen.queryByText("database secret")).toBeNull();
  });

  it.each([
    new ORPCError("BAD_REQUEST", {
      message:
        "Identity already participates in this Project; request merge review.",
    }),
    new ORPCError("FORBIDDEN", { data: { reason: "PARTICIPATION_DUPLICATE" } }),
    new ORPCError("BAD_REQUEST", {
      status: 409,
      data: { reason: "PARTICIPATION_DUPLICATE" },
    }),
  ])(
    "does not activate duplicate recovery for legacy prose or wrong code/status",
    async (error) => {
      mocks.create.mockRejectedValue(error);
      const user = userEvent.setup();
      await renderCoordination();
      await selectRegisteredUser(user, "user-existing", "Existing Candidate");
      await user.click(screen.getByRole("button", { name: "Add Participation" }));
      const notice = await screen.findByRole("alert");
      expect(notice.textContent).not.toContain("Review request");
      expect(notice.textContent).not.toContain("Identity already participates");
    },
  );

  it("shows non-editable Claim feedback for a validated registration reopening denial", async () => {
    const user = userEvent.setup();
    await renderCoordination();
    const closeButton = screen.getByRole("button", {
      name: "Close registration link link-1",
    });
    mocks.list.mockResolvedValue({
      projectName: "Own Project",
      participations: [],
      invitations: [],
      registrationLinks: [{ id: "link-1", enabled: false }],
      entryContext: {
        partnerOrganizationId: "partner-1",
        hostOrganizationId: "host-1",
        assignedCoordinator: false,
      },
    });
    mocks.setRegistrationLinkOpen.mockResolvedValueOnce({ open: false });
    await user.click(closeButton);
    mocks.setRegistrationLinkOpen.mockRejectedValueOnce(
      new ORPCError("BAD_REQUEST", {
        message: "hostile remote text",
        data: { reason: "REGISTRATION_CLAIM_LOCKED" },
      }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Reopen registration link link-1",
      }),
    );
    expect(
      await screen.findByText(
        "A non-editable Claim prevents reopening registration.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("hostile remote text")).toBeNull();
  });

  it("names only Journey/Cost Allocation references for validated removal refusal", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    mocks.remove.mockRejectedValueOnce(
      new ORPCError("BAD_REQUEST", {
        message: "private SQL",
        data: { reason: "PARTICIPATION_JOURNEY_OR_COST_REFERENCED" },
      }),
    );
    const user = userEvent.setup();
    await renderCoordination();
    await user.click(
      screen.getByRole("button", {
        name: "Remove Project Participation for Own Person",
      }),
    );
    expect(
      await screen.findByText(
        "This Project Participation is referenced by a Participant Journey or Cost Allocation. Request review instead.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("private SQL")).toBeNull();
  });

  it("shows access denied when the server forbids a Partner-side write", async () => {
    mocks.create.mockRejectedValue(
      new ORPCError("FORBIDDEN", { message: "private role details" }),
    );
    const user = userEvent.setup();
    await renderCoordination();
    await selectRegisteredUser(user, "host-user", "Host Candidate");
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

  it("links each Participant to its details page instead of editing inline", async () => {
    await renderCoordination();
    expect(
      screen
        .getByRole("link", { name: "Participant details for Own Person" })
        .getAttribute("href"),
    ).toBe("/partnerships/own-partnership/participants/person-1");
    // ADR-0016: editing lives on the details page, never in a list row.
    expect(screen.queryByLabelText("Country for Own Person")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Save country for Own Person" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Remove Project Participation for Own Person",
      }),
    ).toBeTruthy();
  });

  it("retains Partner mutation controls when the shared scope gate permits", async () => {
    await renderCoordination();
    for (const name of [
      "Add Participation",
      "Remove Project Participation for Own Person",
      "Manage Group Organizers",
    ])
      expect(screen.getByRole("button", { name })).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Show Review Tasks" }),
    );
    expect(
      await screen.findByRole("button", { name: "Assign Review Task to me" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Resolve Review Task" }),
    ).toBeTruthy();
  });

  it.each([
    ORGANIZATION_ROLES.OrganizationOwner,
    ORGANIZATION_ROLES.OrganizationAdmin,
    ORGANIZATION_ROLES.ProjectCoordinator,
  ])(
    "hides every Partner mutation from Hosting %s while retaining read-only navigation",
    async (role) => {
      browserSession.activeOrganizationId = "host-1";
      browserSession.role = role;
      await renderCoordination();
      expect(
        screen.getAllByText(
          "Only the Partner Organization of this Project Partnership issues participant entry points.",
        ).length,
      ).toBeGreaterThan(0);
      for (const name of [
        "Add Participation",
        "Remove Project Participation for Own Person",
        "Manage Group Organizers",
        "Send Participant Invitation",
        "Create Participant Registration Link",
        "Reissue invitation for pending@example.org",
        "Close invitation for pending@example.org",
        "Close registration link link-1",
        "Reopen registration link link-1",
      ])
        expect(screen.queryByRole("button", { name })).toBeNull();
      // Oversight of the existing entries stays available.
      expect(screen.getByText("pending@example.org")).toBeTruthy();
      expect(screen.getByText("Link link-1")).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Participant details for Own Person" }),
      ).toBeTruthy();
      await userEvent.click(
        screen.getByRole("button", { name: "Show Review Tasks" }),
      );
      await screen.findByText("Registered User: review@example.org");
      expect(
        screen.getByText("Registered User: assigned@example.org"),
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Assign Review Task to me" }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Resolve Review Task" }),
      ).toBeNull();
      expect(screen.queryByLabelText("Review Task decision")).toBeNull();
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.remove).not.toHaveBeenCalled();
    },
  );

  it("gates all Partner controls on the same coordinator assignment", async () => {
    browserSession.role = ORGANIZATION_ROLES.ProjectCoordinator;
    await renderCoordination();
    expect(
      screen.getAllByText(
        "Ask an Organization Owner or Admin to assign you as Group Organizer for this Project Partnership.",
      ).length,
    ).toBeGreaterThan(0);
    for (const name of [
      "Send Participant Invitation",
      "Add Participation",
      "Remove Project Participation for Own Person",
      "Manage Group Organizers",
    ])
      expect(screen.queryByRole("button", { name })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Show Review Tasks" }),
    );
    await screen.findByText("Registered User: review@example.org");
    expect(
      screen.queryByRole("button", { name: "Assign Review Task to me" }),
    ).toBeNull();
  });

  it("fails closed when the scope report or the active Organization is missing", async () => {
    mocks.list.mockResolvedValue({
      projectName: "Own Project",
      participations: [],
      invitations: [
        { invitationId: "invite-1", email: "p@example.org", status: "pending" },
      ],
      registrationLinks: [],
    });
    await renderCoordination();
    expect(
      screen.queryByRole("button", {
        name: "Reissue invitation for p@example.org",
      }),
    ).toBeNull();
    mocks.list.mockResolvedValue({
      projectName: "Own Project",
      participations: [],
      invitations: [
        { invitationId: "invite-2", email: "q@example.org", status: "pending" },
      ],
      registrationLinks: [],
      entryContext: {
        partnerOrganizationId: "partner-1",
        hostOrganizationId: "host-1",
        assignedCoordinator: false,
      },
    });
    browserSession.activeOrganizationId = null;
    await renderCoordination();
    expect(
      screen.getAllByText(
        "Select an active Partner Organization before issuing participant entry points.",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", {
        name: "Reissue invitation for q@example.org",
      }),
    ).toBeNull();
  });
});
