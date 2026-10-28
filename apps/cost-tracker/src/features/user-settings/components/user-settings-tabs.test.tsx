import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { UserSettingsTabs } from "@/features/user-settings/components/user-settings-tabs";

vi.mock("@/features/user-settings/components/theme-settings", () => ({
  ThemeSettings: () => <p data-testid="theme-controls" />,
}));

vi.mock("@/features/user-settings/components/edit-name-form", () => ({
  EditNameForm: ({ email, name }: { email: string; name: string }) => (
    <p data-testid="account-form" data-name={name} data-email={email} />
  ),
}));

describe("UserSettingsTabs", () => {
  it("renders Account details as the first and only active settings concern initially", () => {
    render(<UserSettingsTabs email="alex@example.org" name="Alex Morgan" />);

    expect(screen.getAllByRole("tab")[0]).toBe(
      screen.getByTestId("settings-tab-account"),
    );

    expect(screen.getByTestId("settings-tab-account")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const activePanel = screen.getByRole("tabpanel");
    expect(within(activePanel).getByTestId("account-form")).toHaveAttribute(
      "data-name",
      "Alex Morgan",
    );
    expect(within(activePanel).getByTestId("account-form")).toHaveAttribute(
      "data-email",
      "alex@example.org",
    );
    expect(
      within(activePanel).getByTestId("settings-panel-heading"),
    ).toBeTruthy();
    expect(screen.queryByTestId("theme-controls")).toBeNull();
  });

  it("switches to Appearance without mixing in account controls", async () => {
    const user = userEvent.setup();
    render(<UserSettingsTabs email="alex@example.org" name="Alex Morgan" />);

    await user.click(screen.getByTestId("settings-tab-appearance"));

    expect(screen.getByTestId("settings-tab-appearance")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const activePanel = screen.getByRole("tabpanel");
    expect(within(activePanel).getByTestId("theme-controls")).toBeTruthy();
    expect(
      within(activePanel).getByTestId("settings-panel-heading"),
    ).toBeTruthy();
    expect(screen.queryByTestId("account-form")).toBeNull();
  });
});
