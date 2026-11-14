import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { ParticipantDetails } from "@/features/participations/components/participant-details";
import { createQueryClient } from "@/lib/tanstack-react-query/client";
import messages from "@/messages/en-GB";

const countryLabel = `${messages.participations.details.countryFor} Alex`;
const countryName = (code: string) =>
  new Intl.DisplayNames(["en"], { type: "region" }).of(code)!;

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
const browserSession = vi.hoisted(() => ({
  userId: "user-1",
  activeOrganizationId: "partner-1" as string | null,
  role: null as string | null,
}));

vi.mock("@/lib/auth-client", async () => {
  const { createAuthClientMock } = await import("@/__tests__/auth-client-mock");
  return { authClient: createAuthClientMock(browserSession) };
});

vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { participations: { update: mocks.update } },
  orpcQuery: {
    participations: {
      get: {
        queryOptions: () => ({
          queryKey: ["participation-details"],
          queryFn: mocks.get,
        }),
      },
      listPartnership: { queryKey: () => ["participations"] },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  browserSession.activeOrganizationId = "partner-1";
  browserSession.role = ORGANIZATION_ROLES.OrganizationOwner;
  mocks.update.mockResolvedValue({ success: true });
  mocks.get.mockResolvedValue({
    projectName: "Workshop",
    participation: {
      id: "person-1",
      displayName: "Alex",
      email: null,
      country: "DE",
    },
    correctionContext: {
      partnerOrganizationId: "partner-1",
      hostOrganizationId: "host-1",
      assignedCoordinator: false,
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

async function renderDetails() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <Suspense fallback={null}>
        <ParticipantDetails
          partnershipId="partnership-1"
          participationId="person-1"
        />
      </Suspense>
    </QueryClientProvider>,
  );
  await screen.findByTestId("participant-details");
}

describe("ParticipantDetails country correction", () => {
  it("displays the current country by name and saves a selected ISO code", async () => {
    const user = userEvent.setup();
    await renderDetails();
    const country = screen.getByRole("combobox", { name: countryLabel });
    expect(country).not.toHaveAttribute("aria-required", "true");
    await user.click(country);
    expect(
      await screen.findByRole("option", { name: countryName("DE") }),
    ).toHaveAttribute("aria-selected", "true");
    await user.click(
      await screen.findByRole("option", { name: countryName("FR") }),
    );
    await user.click(screen.getByTestId("participation-country-save"));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
        partnershipId: "partnership-1",
        id: "person-1",
        country: "FR",
      }),
    );
  });

  it("retains Not set and writes null when selected", async () => {
    const user = userEvent.setup();
    await renderDetails();
    await user.click(screen.getByRole("combobox", { name: countryLabel }));
    await user.click(
      await screen.findByRole("option", {
        name: messages.shell.countrySelector.notSet,
      }),
    );
    await user.click(screen.getByTestId("participation-country-save"));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        partnershipId: "partnership-1",
        id: "person-1",
        country: null,
      }),
    );
  });

  it("disables selection during save and preserves the selection after failure", async () => {
    let refuse!: (error: Error) => void;
    mocks.update.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          refuse = reject;
        }),
    );
    const user = userEvent.setup();
    await renderDetails();
    const country = screen.getByRole("combobox", { name: countryLabel });
    await user.click(country);
    await user.click(
      await screen.findByRole("option", { name: countryName("FR") }),
    );
    await user.click(screen.getByTestId("participation-country-save"));
    await waitFor(() => expect(country).toBeDisabled());
    refuse(new Error("private server detail"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(country);
    expect(
      await screen.findByRole("option", { name: countryName("FR") }),
    ).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    expect(country).toBeEnabled();
  });

  it.each([
    ORGANIZATION_ROLES.OrganizationOwner,
    ORGANIZATION_ROLES.OrganizationAdmin,
    ORGANIZATION_ROLES.ProjectCoordinator,
  ])("keeps Hosting %s read-only", async (role) => {
    browserSession.activeOrganizationId = "host-1";
    browserSession.role = role;
    await renderDetails();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("participation-country-save"),
    ).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
