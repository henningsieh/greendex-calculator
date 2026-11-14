import type { EUCountryCode } from "@greendex/config/eu-countries";
import type { Locator } from "@playwright/test";

import shellMessages from "@/messages/en-GB/shell.json" with { type: "json" };

import { expect } from "./artifact-privacy";

function countryName(code: EUCountryCode): string {
  return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
}

export async function expectSelectedCountry(
  control: Locator,
  code: EUCountryCode,
) {
  const page = control.page();
  await control.click();
  await expect(
    page.getByRole("option", { name: countryName(code), exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(control).toBeFocused();
}

export async function selectCountry(control: Locator, code: EUCountryCode) {
  const page = control.page();
  await control.click();
  await page
    .getByRole("combobox", {
      name: shellMessages.shell.countrySelector.searchLabel,
      exact: true,
    })
    .fill(countryName(code));
  await page
    .getByRole("option", { name: countryName(code), exact: true })
    .click();
}
