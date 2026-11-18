import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

import { PartnerGuideDialog } from "./partner-guide-dialog";

describe("PartnerGuideDialog", () => {
  it("opens the three-step guide from the info trigger", async () => {
    const user = userEvent.setup();
    render(<PartnerGuideDialog />);
    await user.click(await screen.findByTestId("partner-guide-trigger"));
    const dialog = await screen.findByTestId("partner-guide-dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.querySelectorAll("li")).toHaveLength(3);
  });
});
