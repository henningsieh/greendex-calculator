import {
  EU_COUNTRY_CODES,
  type EUCountryCode,
} from "@greendex/config/eu-countries";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { EUCountrySelector } from "@/components/eu-country-selector";
import messages from "@/messages/en";

const fieldLabel = "Country";
const countryName = (code: EUCountryCode, locale = "en") =>
  new Intl.DisplayNames([locale], { type: "region" }).of(code)!;

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
});
afterEach(() => vi.restoreAllMocks());

function Controlled({ optional = false }: { optional?: boolean }) {
  const [value, setValue] = useState<EUCountryCode | "">("");
  return (
    <form aria-label="Selection">
      <EUCountrySelector
        name="country"
        value={value}
        onValueChange={setValue}
        optional={optional}
      />
    </form>
  );
}

describe("EUCountrySelector", () => {
  it("offers only the authoritative EU set, sorted by localized name, with decorative flags", async () => {
    const user = userEvent.setup();
    render(
      <EUCountrySelector aria-label="Country" value="" onValueChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("combobox"));
    const options = await screen.findAllByRole("option");
    const names = EU_COUNTRY_CODES.map((code) =>
      new Intl.DisplayNames(["en"], { type: "region" }).of(code)!,
    ).sort(new Intl.Collator("en").compare);
    expect(options).toHaveLength(EU_COUNTRY_CODES.length);
    options.forEach((option, index) =>
      expect(option).toHaveAccessibleName(names[index]),
    );
    expect(
      screen.queryByRole("option", {
        name: messages.shell.countrySelector.notSet,
      }),
    ).not.toBeInTheDocument();
    for (const option of options) {
      expect(option.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(within(option).queryByRole("img")).not.toBeInTheDocument();
    }
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  });

  it("filters by name, selects an ISO code by keyboard and preserves the closed value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <form>
        <EUCountrySelector
          name="country"
          value="FR"
          onValueChange={onValueChange}
        />
      </form>,
    );
    await user.click(screen.getByRole("combobox"));
    await user.type(
      await screen.findByRole("combobox", {
        name: messages.shell.countrySelector.searchLabel,
      }),
      "Germany",
    );
    expect(
      await screen.findByRole("option", { name: countryName("DE") }),
    ).toBeVisible();
    expect(
      screen.queryByRole("option", { name: countryName("FR") }),
    ).not.toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("DE");
    expect(new FormData(container.querySelector("form")!).get("country")).toBe(
      "FR",
    );
    expect(
      screen.getByRole("combobox").querySelector("svg[focusable=false]"),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("updates controlled selection and supports an optional Not set item without a clear button", async () => {
    const user = userEvent.setup();
    render(<Controlled optional />);
    await user.click(screen.getByRole("combobox"));
    await user.click(
      await screen.findByRole("option", { name: countryName("DE") }),
    );
    expect(
      new FormData(screen.getByRole("form") as HTMLFormElement).get("country"),
    ).toBe("DE");
    await user.click(screen.getByRole("combobox"));
    await user.click(
      await screen.findByRole("option", {
        name: messages.shell.countrySelector.notSet,
      }),
    );
    expect(
      new FormData(screen.getByRole("form") as HTMLFormElement).get("country"),
    ).toBe("");
  });

  it("opens and closes by keyboard, restores focus, and exposes an empty search state", async () => {
    const user = userEvent.setup();
    render(
      <EUCountrySelector
        aria-label={fieldLabel}
        value=""
        onValueChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.tab();
    await user.keyboard("{Enter}");
    const search = await screen.findByRole("combobox", {
      name: messages.shell.countrySelector.searchLabel,
    });
    expect(search).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.type(search, "zzzzzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "false"),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("preserves label association, invalid description and disabled state", async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="country">Country</label>
        <p id="error">Choose a country</p>
        <EUCountrySelector
          id="country"
          value="DE"
          onValueChange={vi.fn()}
          disabled
          aria-invalid
          aria-describedby="error"
        />
      </>,
    );
    const control = screen.getByRole("combobox");
    expect(control).toHaveAccessibleName(fieldLabel);
    expect(control).toBeDisabled();
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAccessibleDescription("Choose a country");
    await user.click(control);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("localizes names and sorting in German", async () => {
    const user = userEvent.setup();
    render(<EUCountrySelector value="DE" onValueChange={vi.fn()} />, {
      locale: "de",
    });

    await user.click(screen.getByRole("combobox"));
    const names = EU_COUNTRY_CODES.map((code) =>
      new Intl.DisplayNames(["de"], { type: "region" }).of(code)!,
    ).sort(new Intl.Collator("de").compare);
    const options = await screen.findAllByRole("option");
    options.forEach((option, index) =>
      expect(option).toHaveAccessibleName(names[index]),
    );
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  });
});
