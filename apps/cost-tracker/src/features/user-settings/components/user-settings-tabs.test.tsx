import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { UserSettingsTabs } from "@/features/user-settings/components/user-settings-tabs";

vi.mock("@/features/user-settings/components/theme-settings", () => ({
  ThemeSettings: () => <p>Theme controls</p>,
}));

vi.mock("@/features/user-settings/components/edit-name-form", () => ({
  EditNameForm: ({ email, name }: { email: string; name: string }) => (
    <p>
      Account form for {name}, {email}
    </p>
  ),
}));

describe("UserSettingsTabs", () => {
  it("renders Account details as the first and only active settings concern initially", () => {
    render(<UserSettingsTabs email="alex@example.org" name="Alex Morgan" />);

    expect(screen.getAllByRole("tab")[0]?.textContent).toBe("Account details");

    const activePanel = screen.getByRole("tabpanel");
    expect(
      within(activePanel).getByText(
        "Account form for Alex Morgan, alex@example.org",
      ),
    ).toBeTruthy();
    expect(
      within(activePanel).getByRole("heading", { name: "Account details" }),
    ).toBeTruthy();
    expect(screen.queryByText("Theme controls")).toBeNull();
  });

  it("switches to Appearance without mixing in account controls", async () => {
    const user = userEvent.setup();
    render(<UserSettingsTabs email="alex@example.org" name="Alex Morgan" />);

    await user.click(screen.getByRole("tab", { name: "Appearance" }));

    const activePanel = screen.getByRole("tabpanel");
    expect(within(activePanel).getByText("Theme controls")).toBeTruthy();
    expect(
      within(activePanel).getByRole("heading", { name: "Appearance" }),
    ).toBeTruthy();
    expect(screen.queryByText(/Account form for/)).toBeNull();
  });
});
