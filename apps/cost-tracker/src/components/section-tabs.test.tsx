import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import {
  SectionTabs,
  SectionTabsContent,
  SectionTabsList,
  SectionTabsRow,
  SectionTabsTrigger,
  SectionTabsWrapper,
} from "@/components/section-tabs";
import { tabsTriggerVariants } from "@/components/ui/tabs";

function renderSectionTabs() {
  return render(
    <SectionTabsWrapper>
      <SectionTabsRow>
        <SectionTabs defaultValue="account">
          <SectionTabsList aria-label="sections">
            <SectionTabsTrigger value="account">Account</SectionTabsTrigger>
            <SectionTabsTrigger value="appearance">Appearance</SectionTabsTrigger>
          </SectionTabsList>
          <SectionTabsContent value="account">Account panel</SectionTabsContent>
        </SectionTabs>
        <p data-testid="trailing">Trailing</p>
      </SectionTabsRow>
    </SectionTabsWrapper>,
  );
}

describe("SectionTabs", () => {
  it("locks the section-tab rhythm to one position and one trigger style", () => {
    const { container } = renderSectionTabs();

    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("mt-10");

    const list = screen.getByRole("tablist");
    expect(list).toHaveAttribute("data-variant", "line");

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("data-variant", "line");
      expect(tab.className).toContain("text-sm");
      expect(tab.className).not.toContain("text-base");
    }

    expect(container.querySelector('[data-slot="tabs-indicator"]')).toBeTruthy();
    expect(screen.getByTestId("trailing")).toBeTruthy();
  });

  it("has no second line trigger size to diverge to", () => {
    expect(tabsTriggerVariants({ variant: "line" })).toContain("text-sm");
    expect(tabsTriggerVariants({ variant: "line" as never })).not.toContain(
      "text-base",
    );
  });
});
