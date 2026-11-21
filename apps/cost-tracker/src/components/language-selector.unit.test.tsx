import { SUPPORTED_LANGUAGES } from "@greendex/config/languages";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { renderWithMessages } from "@/__tests__/render-with-messages";

const mocks = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  permanentRedirect: vi.fn(),
  redirect: vi.fn(),
  usePathname: () => "/projects",
  useRouter: () => ({ replace: mocks.replace }),
}));

import { LanguageSelector } from "@/components/language-selector";

beforeEach(() => {
  mocks.replace.mockClear();
  window.history.replaceState({}, "", "/en-GB/projects?view=table#top");
});

it("names the trigger with the current language", () => {
  renderWithMessages(<LanguageSelector />);

  expect(screen.getByTestId("language-selector-trigger")).toHaveAccessibleName(
    /language: English \(UK\)\. change language/i,
  );
});

it("offers every configured language", async () => {
  const user = userEvent.setup();
  renderWithMessages(<LanguageSelector />);

  await user.click(screen.getByTestId("language-selector-trigger"));

  const options = await screen.findAllByRole("menuitem");
  expect(options).toHaveLength(SUPPORTED_LANGUAGES.length);
  expect(options.map((option) => option.getAttribute("data-language"))).toEqual(
    SUPPORTED_LANGUAGES.map((language) => language.code),
  );
});

it("changes locale without dropping query or hash state", async () => {
  const user = userEvent.setup();
  renderWithMessages(<LanguageSelector />);

  await user.click(screen.getByTestId("language-selector-trigger"));
  await screen.findAllByRole("menuitem");
  const french = document.querySelector<HTMLElement>('[data-language="fr"]');
  expect(french).not.toBeNull();
  await user.click(french!);

  await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
  const [href] = mocks.replace.mock.calls[0]!;
  expect(href).toContain("/fr/projects?view=table#top");
});
