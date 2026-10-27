import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
      <button data-testid="confirm-harness-request" onClick={request}>
        Request
      </button>
      <output
        data-testid="confirm-harness-status"
        data-results={results.join(",")}
      />
      {dialog}
    </>
  );
}

function requestDialog() {
  return screen.getByTestId("confirm-harness-request");
}

function dialogButtons() {
  const dialog = screen.getByRole("dialog");
  return {
    dialog,
    execute: within(dialog).getByTestId("confirm-dialog-execute"),
    cancel: within(dialog).getByTestId("confirm-dialog-cancel"),
    close: within(dialog).getByTestId("confirm-dialog-close"),
  };
}

function status() {
  return screen.getByTestId("confirm-harness-status");
}

describe("confirmation request", () => {
  it("uses generic labels when none are supplied", async () => {
    const user = userEvent.setup();
    render(<Harness generic />);
    await user.click(requestDialog());
    const first = dialogButtons();
    expect(first.execute).toBeVisible();
    expect(first.close).toBeVisible();
    await user.click(first.cancel);
    expect(status()).toHaveAttribute("data-results", "second=false,first=false");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await user.click(requestDialog());
    const second = dialogButtons();
    await user.click(second.execute);
    expect(status()).toHaveAttribute(
      "data-results",
      "second=false,first=false,second=false,first=true",
    );
  });

  it("rejects a concurrent request without replacing the first and executes once", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(requestDialog());
    const { cancel, execute } = dialogButtons();
    expect(status()).toHaveAttribute("data-results", "second=false");
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.click(execute);
    expect(status()).toHaveAttribute("data-results", "second=false,first=true");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(requestDialog()).toHaveFocus());
  });

  it.each([
    ["cancel", "confirm-dialog-cancel"],
    ["close", "confirm-dialog-close"],
    ["Escape", "keyboard"],
    ["backdrop", "overlay"],
  ] as const)("resolves false on %s", async (dismiss, target) => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(requestDialog());
    if (target === "keyboard") await user.keyboard("{Escape}");
    else if (target === "overlay") {
      const backdrop = document.querySelector('[data-slot="dialog-overlay"]')!;
      fireEvent.mouseDown(backdrop);
      fireEvent.mouseUp(backdrop);
      fireEvent.click(backdrop);
    } else {
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByTestId(target));
    }
    await waitFor(() =>
      expect(status()).toHaveAttribute(
        "data-results",
        "second=false,first=false",
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
