import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithMessages } from "@/__tests__/render-with-messages";
import { ArchivedActionExplanation } from "@/components/archived-action-explanation";

describe("Archived action explanation", () => {
  it.each(["link", "icon"] as const)(
    "keeps the %s explanation open when clicking after hover",
    async (variant) => {
      // Keep the click within Base UI's hover grace period even on a busy host.
      vi.useFakeTimers();
      try {
        const { unmount } = renderWithMessages(
          <ArchivedActionExplanation variant={variant} />,
        );
        const trigger = screen.getByTestId("archive-explanation-trigger");
        fireEvent.mouseEnter(trigger);
        expect(trigger).toHaveAttribute("aria-expanded", "true");
        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute("aria-expanded", "true");
        fireEvent.keyDown(trigger, { key: "Escape" });
        await act(() => vi.runOnlyPendingTimersAsync());
        expect(
          screen.queryByTestId("archive-explanation-content"),
        ).not.toBeInTheDocument();
        unmount();
      } finally {
        vi.useRealTimers();
      }
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
