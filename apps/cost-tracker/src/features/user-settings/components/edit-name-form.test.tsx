import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditNameForm } from "@/features/user-settings/components/edit-name-form";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { updateUser: mocks.updateUser },
}));

function renderForm() {
  render(<EditNameForm email="alex@example.org" name="Alex Morgan" />);

  return {
    nameInput: screen.getByRole("textbox", { name: "Name" }),
    saveButton: screen.getByRole("button", { name: /save name/i }),
  };
}

async function enterName(nameInput: HTMLElement, name: string) {
  const user = userEvent.setup();
  await user.clear(nameInput);
  await user.type(nameInput, name);

  return user;
}

describe("EditNameForm", () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
    mocks.updateUser.mockReset();
  });

  it("shows the current account values and starts with saving disabled", () => {
    const { nameInput, saveButton } = renderForm();
    const emailInput = screen.getByRole("textbox", { name: "Email address" });

    expect((nameInput as HTMLInputElement).value).toBe("Alex Morgan");
    expect((emailInput as HTMLInputElement).value).toBe("alex@example.org");
    expect((emailInput as HTMLInputElement).disabled).toBe(true);
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows schema validation and does not call Better Auth for an invalid name", async () => {
    const { nameInput, saveButton } = renderForm();
    const user = await enterName(nameInput, "A");

    await user.click(saveButton);

    expect(await screen.findByText("Enter at least 2 characters.")).toBeTruthy();
    expect(nameInput.getAttribute("aria-invalid")).toBe("true");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("trims and saves a valid name, refreshes the session UI, and resets the form", async () => {
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
    const { nameInput, saveButton } = renderForm();
    const user = await enterName(nameInput, "  Morgan Lee  ");

    await user.click(saveButton);

    await waitFor(() => {
      expect(mocks.updateUser).toHaveBeenCalledWith({ name: "Morgan Lee" });
    });
    expect(await screen.findByText("Your name has been updated.")).toBeTruthy();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect((nameInput as HTMLInputElement).value).toBe("Morgan Lee");
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the Better Auth error and clears it when the user edits again", async () => {
    mocks.updateUser.mockResolvedValue({
      data: null,
      error: { message: "Name update blocked." },
    });
    const { nameInput, saveButton } = renderForm();
    const user = await enterName(nameInput, "Morgan Lee");

    await user.click(saveButton);

    expect(await screen.findByText("Name update blocked.")).toBeTruthy();
    expect(mocks.refresh).not.toHaveBeenCalled();

    await user.type(nameInput, " Jr");
    expect(screen.queryByText("Name update blocked.")).toBeNull();
  });

  it("gives actionable feedback when the update request throws", async () => {
    mocks.updateUser.mockRejectedValue(new Error("Network unavailable"));
    const { nameInput, saveButton } = renderForm();
    const user = await enterName(nameInput, "Morgan Lee");

    await user.click(saveButton);

    expect(
      await screen.findByText("Your name could not be updated. Try again."),
    ).toBeTruthy();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("disables repeated submission while the update is pending", async () => {
    let resolveUpdate:
      | ((value: { data: object; error: null }) => void)
      | undefined;
    mocks.updateUser.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    const { nameInput, saveButton } = renderForm();
    const user = await enterName(nameInput, "Morgan Lee");

    await user.click(saveButton);

    expect(
      await screen.findByRole("button", { name: /saving name/i }),
    ).toBeTruthy();
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.updateUser).toHaveBeenCalledOnce();

    resolveUpdate?.({ data: {}, error: null });
    await screen.findByText("Your name has been updated.");
  });
});
