import { NextIntlClientProvider } from "@greendex/i18n/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import german from "@/messages/de";
import messages from "@/messages/en";

const countryLabel = messages.organizations.settings.country;
const countryName = (code: string) =>
  new Intl.DisplayNames(["en"], { type: "region" }).of(code)!;

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
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  mocks.updateCountry.mockResolvedValue({ success: true });
});

describe("Organization country settings", () => {
  it("shows the current country and saves a correction", async () => {
    const user = userEvent.setup();
    renderSettings();
    const control = await screen.findByTestId("organization-country");
    expect(control).toHaveRole("combobox");
    await user.click(screen.getByRole("combobox", { name: countryLabel }));
    expect(
      await screen.findByRole("option", { name: countryName("DE") }),
    ).toHaveAttribute("aria-selected", "true");
    await user.click(
      await screen.findByRole("option", { name: countryName("FR") }),
    );
    await user.click(screen.getByTestId("save-organization-country"));
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
    await user.click(await screen.findByRole("combobox", { name: countryLabel }));
    await user.click(
      await screen.findByRole("option", { name: countryName("FR") }),
    );
    await user.click(screen.getByTestId("save-organization-country"));
    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledExactlyOnceWith({
        title: "Could not save Organization country",
        description: expect.any(Object),
        type: "error",
      }),
    );
    expect(
      renderToStaticMarkup(
        <NextIntlClientProvider locale="de" messages={german}>
          {mocks.toastAdd.mock.calls[0][0].description}
        </NextIntlClientProvider>,
      ),
    ).toBe(
      "Der Server oder das Netzwerk ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.",
    );
    expect(screen.getByTestId("save-organization-country")).not.toBeDisabled();
    await user.click(screen.getByTestId("save-organization-country"));
    await waitFor(() => expect(mocks.updateCountry).toHaveBeenCalledTimes(2));
    expect(mocks.updateCountry).toHaveBeenLastCalledWith({ country: "FR" });
  });
});

it("disables country changes while saving", async () => {
  mocks.updateCountry.mockReturnValue(new Promise(() => {}));
  const user = userEvent.setup({ delay: null });
  renderSettings();
  const country = await screen.findByRole("combobox", {
    name: countryLabel,
  });
  await user.click(screen.getByTestId("save-organization-country"));
  expect(country).toBeDisabled();
  expect(country).toHaveAttribute("aria-required", "true");
});
