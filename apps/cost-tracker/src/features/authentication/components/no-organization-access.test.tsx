import { ORPCError } from "@orpc/client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOrganization: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    authentication: { createOrganization: mocks.createOrganization },
  },
}));

vi.mock("@/features/authentication/components/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { NoOrganizationAccess } from "@/features/authentication/components/no-organization-access";

describe("NoOrganizationAccess", () => {
  beforeEach(() => {
    mocks.createOrganization.mockReset();
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
  });

  it("ends setup at the Project overview after inline Organization creation", async () => {
    mocks.createOrganization.mockResolvedValue({});
    // No inter-keystroke delay: keystroke timing must not eat the timeout.
    const user = userEvent.setup({ delay: null });
    render(<NoOrganizationAccess />);

    expect(screen.getByTestId("no-organization-access")).toHaveRole("main");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("organization-name")).toBeVisible();

    await user.type(screen.getByTestId("organization-name"), "Northwind");
    await user.selectOptions(screen.getByTestId("organization-country"), "DE");
    await user.click(screen.getByTestId("create-organization"));

    expect(mocks.createOrganization).toHaveBeenCalledExactlyOnceWith({
      name: "Northwind",
      slug: "northwind",
      country: "DE",
    });
    expect(screen.getByTestId("no-organization-access")).toHaveRole("main");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/projects");
  });

  it("clears pending state and gives safe feedback when Organization creation rejects", async () => {
    mocks.createOrganization.mockRejectedValue(new Error("network unavailable"));
    // No inter-keystroke delay: keystroke timing must not eat the timeout.
    const user = userEvent.setup({ delay: null });
    render(<NoOrganizationAccess />);
    await user.type(screen.getByTestId("organization-name"), "Northwind");
    await user.selectOptions(screen.getByTestId("organization-country"), "DE");
    await user.click(screen.getByTestId("create-organization"));

    expect(await screen.findByTestId("organization-error")).toBeTruthy();
    expect(screen.getByTestId("create-organization")).not.toBeDisabled();
    expect(screen.getByTestId("no-organization-access")).toHaveRole("main");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("organization-name")).toHaveValue("Northwind");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

it("refreshes authoritative guidance when a stale creation attempt is refused", async () => {
  mocks.createOrganization.mockRejectedValue(
    new ORPCError("FORBIDDEN", {
      data: { reason: "ORGANIZATION_CREATION_DENIED_BEFORE_CREATION" },
    }),
  );
  render(<NoOrganizationAccess />);
  const actor = userEvent.setup({ delay: null });
  await actor.type(screen.getByTestId("organization-name"), "New Organization");
  await actor.selectOptions(screen.getByTestId("organization-country"), "DE");
  await actor.click(screen.getByTestId("create-organization"));
  expect(await screen.findByTestId("organization-error")).toBeVisible();
  expect(mocks.refresh).toHaveBeenCalled();
});
