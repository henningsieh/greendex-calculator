import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

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
    await user.click(screen.getByTestId("new-project"));
    expect(screen.getByTestId("create-project-dialog")).toBeTruthy();
    await user.click(screen.getByTestId("create-project"));
    await waitFor(() =>
      expect(screen.getByTestId("new-project-name")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("new-project-name"), {
      target: { value: "Workshop" },
    });
    fireEvent.change(screen.getByTestId("new-project-start"), {
      target: { value: "2027-04-03" },
    });
    fireEvent.change(screen.getByTestId("new-project-end"), {
      target: { value: "2027-04-01" },
    });
    fireEvent.change(screen.getByTestId("new-project-location"), {
      target: { value: "Berlin" },
    });
    fireEvent.change(screen.getByTestId("new-project-country"), {
      target: { value: "DE" },
    });
    await user.click(screen.getByTestId("create-project"));
    await waitFor(() =>
      expect(screen.getByTestId("new-project-end")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    fireEvent.change(screen.getByTestId("new-project-end"), {
      target: { value: "2027-04-05" },
    });
    fireEvent.change(screen.getByTestId("new-project-welcome"), {
      target: { value: "Welcome!" },
    });
    await user.click(screen.getByTestId("create-project"));
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
    await user.click(screen.getByTestId("new-project"));
    fireEvent.change(screen.getByTestId("new-project-name"), {
      target: { value: "Workshop" },
    });
    fireEvent.change(screen.getByTestId("new-project-start"), {
      target: { value: "2027-04-01" },
    });
    fireEvent.change(screen.getByTestId("new-project-end"), {
      target: { value: "2027-04-03" },
    });
    fireEvent.change(screen.getByTestId("new-project-location"), {
      target: { value: "Berlin" },
    });
    fireEvent.change(screen.getByTestId("new-project-country"), {
      target: { value: "DE" },
    });
    await user.click(screen.getByTestId("create-project"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByTestId("create-project-dialog")).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
