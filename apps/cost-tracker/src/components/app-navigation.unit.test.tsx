import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { renderWithMessages } from "@/__tests__/render-with-messages";

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { authentication: { signOut: mocks.signOut } },
}));
vi.mock("@/components/theme-switcher", () => ({ ThemeSwitcher: () => null }));
vi.mock("@/features/organizations/components/organization-switcher", () => ({
  OrganizationSwitcher: () => null,
}));

import { AppNavigation } from "@/components/app-navigation";

it("closes the account menu before confirmation and returns focus after cancellation", async () => {
  const user = userEvent.setup();
  renderWithMessages(
    <AppNavigation name="Example User" email="user@example.org" />,
  );
  const trigger = screen.getAllByTestId("account-menu-trigger")[0]!;
  await user.click(trigger);
  const signOut = await screen.findByTestId("account-menu-sign-out");
  await user.click(signOut);
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  const cancel = within(dialog).getByTestId("confirm-dialog-cancel");
  await waitFor(() => expect(cancel).toHaveFocus());
  await user.click(cancel);
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(mocks.signOut).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  await user.click(trigger);
  expect(await screen.findByTestId("account-menu-sign-out")).toBeEnabled();
});
