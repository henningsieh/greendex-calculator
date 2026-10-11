import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateCountry: vi.fn(), toastAdd: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({
  toast: { add: mocks.toastAdd },
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { organizations: { updateCountry: mocks.updateCountry } },
  orpcQuery: {
    organizations: {
      getSettings: {
        queryOptions: () => ({
          queryKey: ["organization-settings"],
          queryFn: async () => ({
            id: "org-id",
            name: "Country Org",
            country: "DE",
          }),
        }),
      },
    },
  },
}));

import { OrganizationSettings } from "@/features/organizations/components/organization-settings";

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Suspense fallback={<p>Loading settings</p>}>
        <OrganizationSettings />
      </Suspense>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateCountry.mockResolvedValue({ success: true });
});

describe("Organization country settings", () => {
  it("shows the current country and saves a correction", async () => {
    const user = userEvent.setup();
    renderSettings();
    const control = await screen.findByLabelText("Organization country");
    expect(control).toHaveValue("DE");
    await user.selectOptions(control, "FR");
    await user.click(
      screen.getByRole("button", { name: "Save Organization country" }),
    );
    await waitFor(() =>
      expect(mocks.updateCountry).toHaveBeenCalledWith({ country: "FR" }),
    );
    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledExactlyOnceWith({
        title: "Organization country saved.",
        type: "success",
      }),
    );
  });

  it("surfaces safe feedback and allows retry after failure", async () => {
    mocks.updateCountry.mockRejectedValueOnce(new Error("network unavailable"));
    const user = userEvent.setup();
    renderSettings();
    await screen.findByLabelText("Organization country");
    await user.click(
      screen.getByRole("button", { name: "Save Organization country" }),
    );
    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledExactlyOnceWith({
        title: "Could not save Organization country",
        description:
          "The server or network is unreachable. Check your connection and try again.",
        type: "error",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Save Organization country" }),
    ).not.toBeDisabled();
  });
});
