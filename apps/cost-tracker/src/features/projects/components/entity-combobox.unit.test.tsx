import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { EntityCombobox } from "@/features/projects/components/entity-combobox";

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
    await user.click(screen.getByRole("button", { name: "Organization" }));
    expect(screen.getByText("Local")).toBeTruthy();
    const input = screen.getByLabelText("Search Organization by name or ID");
    await user.type(input, "p");
    expect(search).not.toHaveBeenCalled();
    await user.type(input, "artner-123");
    expect(await screen.findByText("Green Partner")).toBeTruthy();
    expect(search).toHaveBeenCalledWith("partner-123");
    await user.click(screen.getByText("Green Partner"));
    expect(onChange).toHaveBeenCalledWith("partner-123");
  });

  it("labels Participant searches for email while showing only name and ID", async () => {
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
    await user.click(
      screen.getByRole("button", { name: "Onboarded Participant" }),
    );
    await user.type(
      screen.getByLabelText("Search Onboarded Participant by name, email or ID"),
      "person@example.org",
    );
    expect(await screen.findByText("Onboarded Person")).toBeTruthy();
    expect(search).toHaveBeenCalledWith("person@example.org");
    expect(screen.getByText("user-123")).toBeTruthy();
    expect(screen.queryByText("person@example.org")).toBeNull();
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
    await user.click(screen.getByRole("button", { name: "Organization" }));
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
    await user.click(screen.getByRole("button", { name: "Project" }));
    await user.type(screen.getByLabelText("Search Project by name or ID"), "zz");
    expect(await screen.findByText("Search failed.")).toBeTruthy();
    expect(screen.queryByText(/private connection/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByText("No matches — refine or paste full ID"),
    ).toBeTruthy();
  });
});
