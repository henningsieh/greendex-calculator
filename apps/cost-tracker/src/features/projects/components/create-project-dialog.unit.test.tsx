import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  permanentRedirect: vi.fn(),
  redirect: vi.fn(),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { projects: { create: mocks.create } },
}));

import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog";
import messages from "@/messages/en-GB";

const countryName = new Intl.DisplayNames(["en"], { type: "region" }).of("DE")!;

async function selectDate(
  user: ReturnType<typeof userEvent.setup>,
  testId: string,
  isoDate: string,
) {
  await user.click(screen.getByTestId(testId));
  const popover = within(screen.getByTestId(`${testId}-popover`));
  for (let step = 0; step < 24; step += 1) {
    if (popover.queryByTestId(`calendar-day-${isoDate}`)) break;
    await user.click(popover.getByTestId("calendar-next"));
  }
  await user.click(popover.getByTestId(`calendar-day-${isoDate}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }) satisfies Partial<MediaQueryList>,
  );
  Element.prototype.scrollIntoView = vi.fn();
  mocks.create.mockResolvedValue({ id: "created-project" });
});

afterEach(() => vi.restoreAllMocks());

describe("New project dialog", { timeout: 60_000 }, () => {
  it("labels all details, exposes field errors, and navigates after success", async () => {
    const user = userEvent.setup();
    render(<CreateProjectDialog />);
    await user.click(screen.getByTestId("new-project"));
    expect(screen.getByTestId("create-project-dialog")).toBeTruthy();
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass(
      "fixed",
      "inset-0",
      "z-50",
    );
    await user.click(screen.getByTestId("create-project"));
    await waitFor(() =>
      expect(screen.getByTestId("new-project-name")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(await screen.findByTestId("new-project-name-error")).toHaveAttribute(
      "data-error-type",
      "too_small",
    );
    expect(mocks.create).not.toHaveBeenCalled();
    const country = screen.getByRole("combobox", {
      name: messages.projects.create.country,
    });
    expect(country).toHaveAttribute("aria-required", "true");
    expect(country).toHaveAttribute("aria-invalid", "true");
    expect(country).toHaveAccessibleDescription();
    expect(country).toHaveAttribute("aria-expanded", "false");
    fireEvent.change(screen.getByTestId("new-project-name"), {
      target: { value: "Workshop" },
    });
    await selectDate(user, "new-project-start", "2027-04-03");
    await selectDate(user, "new-project-end", "2027-04-05");
    await selectDate(user, "new-project-start", "2027-04-10");
    fireEvent.change(screen.getByTestId("new-project-location"), {
      target: { value: "Berlin" },
    });
    await user.click(
      screen.getByRole("combobox", { name: messages.projects.create.country }),
    );
    await user.click(await screen.findByRole("option", { name: countryName }));
    expect(screen.getByTestId("new-project-country")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(screen.queryByTestId("new-project-country-error")).toBeNull();
    await user.click(screen.getByTestId("create-project"));
    await waitFor(() =>
      expect(screen.getByTestId("new-project-end")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(await screen.findByTestId("new-project-end-error")).toHaveAttribute(
      "data-error-type",
      "custom",
    );
    await selectDate(user, "new-project-end", "2027-04-12");
    await waitFor(() =>
      expect(screen.getByTestId("create-project-span")).toHaveAttribute(
        "data-days",
        "3",
      ),
    );
    fireEvent.change(screen.getByTestId("new-project-welcome"), {
      target: { value: "Welcome!" },
    });
    await user.click(screen.getByTestId("create-project"));
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/en-GB/projects/created-project", {
        transitionTypes: ["nav-forward"],
      }),
    );
    await user.click(screen.getByTestId("new-project"));
    await user.click(
      screen.getByRole("combobox", { name: messages.projects.create.country }),
    );
    await screen.findAllByRole("option");
    expect(screen.queryAllByRole("option", { selected: true })).toHaveLength(0);
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.getByTestId("new-project-country")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(mocks.create).toHaveBeenCalledWith({
      name: "Workshop",
      startDate: new Date("2027-04-10T00:00:00.000Z"),
      endDate: new Date("2027-04-12T00:00:00.000Z"),
      location: "Berlin",
      country: "DE",
      welcomeMessage: "Welcome!",
    });
  });

  it("keeps the dialog open and announces server errors", async () => {
    let rejectCreate!: (error: Error) => void;
    mocks.create.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectCreate = reject;
        }),
    );
    const user = userEvent.setup();
    render(<CreateProjectDialog />);
    await user.click(screen.getByTestId("new-project"));
    fireEvent.change(screen.getByTestId("new-project-name"), {
      target: { value: "Workshop" },
    });
    await selectDate(user, "new-project-start", "2027-04-01");
    await selectDate(user, "new-project-end", "2027-04-03");
    fireEvent.change(screen.getByTestId("new-project-location"), {
      target: { value: "Berlin" },
    });
    await user.click(
      screen.getByRole("combobox", { name: messages.projects.create.country }),
    );
    await user.click(await screen.findByRole("option", { name: countryName }));
    await user.click(screen.getByTestId("create-project"));
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: messages.projects.create.country }),
      ).toBeDisabled(),
    );
    expect(screen.getByTestId("create-project")).toBeDisabled();
    rejectCreate(new Error("Network unavailable"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: messages.projects.create.country }),
    ).toBeEnabled();
    expect(screen.getByTestId("create-project-dialog")).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("combobox", { name: messages.projects.create.country }),
    );
    expect(
      await screen.findByRole("option", { name: countryName, selected: true }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    mocks.create.mockResolvedValueOnce({ id: "created-project" });
    await user.click(screen.getByTestId("create-project"));
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/en-GB/projects/created-project", {
        transitionTypes: ["nav-forward"],
      }),
    );
    expect(mocks.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ country: "DE" }),
    );
  });
});
