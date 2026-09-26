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
  update: vi.fn(),
}));

vi.mock("@/lib/orpc/orpc", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/orpc/orpc")>();
  return {
    ...original,
    orpc: { participations: { create: mocks.create, update: mocks.update } },
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

describe("ParticipantCoordination", () => {
  beforeEach(() => {
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
    });
    mocks.create.mockReset();
    mocks.update.mockReset();
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
    await user.type(screen.getByLabelText("Onboarded User ID"), "user-existing");
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
    await user.type(screen.getByLabelText("Onboarded User ID"), "user-existing");
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
    await user.type(screen.getByLabelText("Onboarded User ID"), "host-user");
    await user.click(screen.getByRole("button", { name: "Add Participation" }));
    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain("Access denied");
    expect(notice.textContent).toContain("You do not have permission");
    expect(notice.textContent).not.toContain("private role details");
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
