import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { useConfirmDialog } from "@/components/confirm-dialog";

const options = {
  title: "Remove item?",
  description: "This cannot be undone.",
  confirmText: "Execute",
  cancelText: "Cancel",
  closeText: "Close",
  isDestructive: true,
};

function Harness({ generic = false }: { generic?: boolean }) {
  const { confirm, dialog } = useConfirmDialog();
  const [results, setResults] = useState<string[]>([]);
  async function request() {
    const first = confirm(
      generic
        ? { title: options.title, description: options.description }
        : options,
    );
    const second = await confirm({ ...options, title: "Replacement?" });
    setResults((current) => [...current, `second=${second}`]);
    const result = await first;
    setResults((current) => [...current, `first=${result}`]);
  }
  return (
    <>
      <button onClick={request}>Request</button>
      <output>{results.join(",")}</output>
      {dialog}
    </>
  );
}

describe("confirmation request", () => {
  it("uses generic labels when none are supplied", async () => {
    const user = userEvent.setup();
    render(<Harness generic />);
    await user.click(screen.getByRole("button", { name: "Request" }));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
      "second=false,first=false",
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Request" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
      "second=false,first=false,second=false,first=true",
    );
  });

  it("rejects a concurrent request without replacing the first and executes once", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Request" }));
    expect(screen.getByRole("dialog", { name: "Remove item?" })).toBeVisible();
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
      "second=false",
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
    await user.click(screen.getByRole("button", { name: "Execute" }));
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
      "second=false,first=true",
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Request" })).toHaveFocus(),
    );
  });

  it.each(["Cancel", "Close", "Escape", "backdrop"])(
    "resolves false on %s",
    async (dismiss) => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.click(screen.getByRole("button", { name: "Request" }));
      if (dismiss === "Escape") await user.keyboard("{Escape}");
      else if (dismiss === "backdrop") {
        const backdrop = document.querySelector('[data-slot="dialog-overlay"]')!;
        fireEvent.mouseDown(backdrop);
        fireEvent.mouseUp(backdrop);
        fireEvent.click(backdrop);
      } else await user.click(screen.getByRole("button", { name: dismiss }));
      await waitFor(() =>
        expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
          "second=false,first=false",
        ),
      );
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
    },
  );
});
