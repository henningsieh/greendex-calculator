import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

vi.mock("@/components/ui/popover", async () => {
  const { createContext, useContext, cloneElement } = await import("react");
  const Context = createContext({
    open: false,
    onOpenChange: (_open: boolean) => {},
  });
  return {
    Popover: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) => (
      <Context.Provider value={{ open, onOpenChange }}>
        {children}
      </Context.Provider>
    ),
    PopoverTrigger: ({ render }: { render: React.ReactElement }) => {
      const { onOpenChange } = useContext(Context);
      return cloneElement(render as React.ReactElement<{ onClick: () => void }>, {
        onClick: () => onOpenChange(true),
      });
    },
    PopoverContent: ({ children }: { children: React.ReactNode }) =>
      useContext(Context).open ? <div>{children}</div> : null,
  };
});

import { EntityCombobox } from "@/components/entity-combobox";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

describe("EntityCombobox", () => {
  it("preloads names, stores IDs, and searches name or ID after two characters", async () => {
    const user = userEvent.setup();
    const search = vi
      .fn()
      .mockResolvedValue([{ id: "partner-123", name: "Green Partner" }]);
    const onChange = vi.fn();
    render(
      <EntityCombobox
        label="Organization"
        value=""
        onChange={onChange}
        preload={[{ id: "local-1", name: "Local" }]}
        search={search}
      />,
    );
    await user.click(screen.getByTestId("entity-combobox-trigger"));
    expect(screen.getByRole("option")).toBeTruthy();
    const input = screen.getByTestId("entity-search");
    await user.type(input, "p");
    expect(search).not.toHaveBeenCalled();
    await user.type(input, "artner-123");
    expect(await screen.findByRole("option")).toBeTruthy();
    expect(search).toHaveBeenCalledWith("partner-123");
    await user.click(screen.getByRole("option"));
    expect(onChange).toHaveBeenCalledWith("partner-123");
  });

  it("supports Participant email searches and preserves the result ID", async () => {
    const user = userEvent.setup();
    const search = vi
      .fn()
      .mockResolvedValue([{ id: "user-123", name: "Onboarded Person" }]);
    render(
      <EntityCombobox
        label="Onboarded Participant"
        value=""
        onChange={vi.fn()}
        search={search}
        searchBy="name, email or ID"
      />,
    );
    await user.click(screen.getByTestId("entity-combobox-trigger"));
    await user.type(screen.getByTestId("entity-search"), "person@example.org");
    expect(await screen.findByRole("option")).toBeTruthy();
    expect(search).toHaveBeenCalledWith("person@example.org");
    expect(screen.getByRole("option")).toHaveAttribute(
      "data-entity-id",
      "user-123",
    );
  });

  it("selects the highlighted result by keyboard and keeps the ID", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EntityCombobox
        label="Organization"
        value=""
        onChange={onChange}
        preload={[{ id: "org-key", name: "Keyboard Org" }]}
      />,
    );
    await user.click(screen.getByTestId("entity-combobox-trigger"));
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("org-key");
  });

  it("shows safe empty and retry states", async () => {
    const user = userEvent.setup();
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error("private connection"))
      .mockResolvedValue([]);
    render(
      <EntityCombobox
        label="Project"
        value=""
        onChange={vi.fn()}
        search={search}
      />,
    );
    await user.click(screen.getByTestId("entity-combobox-trigger"));
    await user.type(screen.getByTestId("entity-search"), "zz");
    expect(await screen.findByRole("alert")).toBeTruthy();
    await user.click(screen.getByTestId("retry-entity-search"));
    expect(await screen.findByTestId("entity-search-empty")).toBeTruthy();
  });
});
