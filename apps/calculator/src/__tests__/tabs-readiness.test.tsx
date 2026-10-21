import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function ProjectTabs() {
  return (
    <Tabs defaultValue="details">
      <TabsList>
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="participants">Participants</TabsTrigger>
        <TabsTrigger disabled value="unavailable">
          Unavailable
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details">Project overview</TabsContent>
      <TabsContent value="participants">Participant journeys</TabsContent>
    </Tabs>
  );
}

describe("Tab interaction readiness", () => {
  it("disables the server preview, then accepts the first hydrated selection", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ProjectTabs />);
    document.body.append(container);
    const participants = container.querySelector<HTMLButtonElement>(
      '[role="tab"][data-state="inactive"]',
    )!;
    expect(participants.disabled).toBe(true);
    let root!: ReturnType<typeof hydrateRoot>;
    try {
      await act(async () => {
        root = hydrateRoot(container, <ProjectTabs />);
      });
      expect(participants.disabled).toBe(false);
      expect(
        container.querySelector<HTMLButtonElement>(
          '[role="tab"][data-state="inactive"]:last-child',
        )!.disabled,
      ).toBe(true);
      await act(async () => {
        participants.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            button: 0,
            ctrlKey: false,
          }),
        );
      });
      expect(participants.getAttribute("aria-selected")).toBe("true");
      expect(
        container.querySelector('[role="tabpanel"][data-state="active"]')!
          .textContent,
      ).toBe("Participant journeys");
    } finally {
      if (root) await act(async () => root.unmount());
      container.remove();
    }
  });
});
