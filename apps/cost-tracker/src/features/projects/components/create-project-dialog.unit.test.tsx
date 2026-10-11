import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { projects: { create: mocks.create } },
}));

import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ id: "created-project" });
});

describe("New project dialog", { timeout: 60_000 }, () => {
  it("labels all details, exposes field errors, and navigates after success", async () => {
    const user = userEvent.setup();
    render(<CreateProjectDialog />);
    await user.click(screen.getByRole("button", { name: "New project" }));
    expect(screen.getByRole("dialog", { name: "New project" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByText("Name is required")).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Workshop" },
    });
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2027-04-03" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2027-04-01" },
    });
    fireEvent.change(screen.getByLabelText("Location"), {
      target: { value: "Berlin" },
    });
    fireEvent.change(screen.getByLabelText("Country"), {
      target: { value: "DE" },
    });
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(
      await screen.findByText("End date must not precede start date."),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2027-04-05" },
    });
    fireEvent.change(screen.getByLabelText("Welcome message (optional)"), {
      target: { value: "Welcome!" },
    });
    await user.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/projects/created-project"),
    );
    expect(mocks.create).toHaveBeenCalledWith({
      name: "Workshop",
      startDate: new Date("2027-04-03T00:00:00.000Z"),
      endDate: new Date("2027-04-05T00:00:00.000Z"),
      location: "Berlin",
      country: "DE",
      welcomeMessage: "Welcome!",
    });
  });

  it("keeps the dialog open and announces server errors", async () => {
    mocks.create.mockRejectedValue(new Error("Network unavailable"));
    const user = userEvent.setup();
    render(<CreateProjectDialog />);
    await user.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Workshop" },
    });
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2027-04-01" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2027-04-03" },
    });
    fireEvent.change(screen.getByLabelText("Location"), {
      target: { value: "Berlin" },
    });
    fireEvent.change(screen.getByLabelText("Country"), {
      target: { value: "DE" },
    });
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "New project" })).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
