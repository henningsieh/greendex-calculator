import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithMessages } from "@/__tests__/render-with-messages";
import { ArchivedActionExplanation } from "@/components/archived-action-explanation";

describe("Archived action explanation", () => {
  it.each(["link", "icon"] as const)(
    "keeps the %s explanation open when clicking after hover",
    async (variant) => {
      const user = userEvent.setup();
      renderWithMessages(<ArchivedActionExplanation variant={variant} />);
      const trigger = screen.getByTestId("archive-explanation-trigger");
      await user.hover(trigger);
      expect(
        await screen.findByTestId("archive-explanation-content"),
      ).toBeVisible();
      await user.click(trigger);
      expect(
        await screen.findByTestId("archive-explanation-content"),
      ).toBeVisible();
      await user.keyboard("{Escape}");
      await waitFor(() =>
        expect(
          screen.queryByTestId("archive-explanation-content"),
        ).not.toBeInTheDocument(),
      );
    },
  );

  it("opens from the keyboard without opening on focus alone", async () => {
    const user = userEvent.setup();
    renderWithMessages(<ArchivedActionExplanation />);
    await user.tab();
    expect(screen.getByTestId("archive-explanation-trigger")).toHaveFocus();
    expect(
      screen.queryByTestId("archive-explanation-content"),
    ).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByTestId("archive-explanation-content"),
    ).toBeVisible();
  });
});
