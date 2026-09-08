import { ORPCError } from "@orpc/client";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";

let shouldThrow = true;

function FailingProjectDataView({ error }: { error: Error }) {
  if (shouldThrow) {
    throw error;
  }

  return <p>Project data loaded</p>;
}

describe("ProjectDataErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a safe access message for typed oRPC access errors", () => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ProjectDataErrorBoundary resource="Projects">
        <FailingProjectDataView error={new ORPCError("FORBIDDEN")} />
      </ProjectDataErrorBoundary>,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "You no longer have access to these Projects.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("offers sign-in recovery for an expired oRPC session", () => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ProjectDataErrorBoundary resource="Projects">
        <FailingProjectDataView error={new ORPCError("UNAUTHORIZED")} />
      </ProjectDataErrorBoundary>,
    );

    expect(
      screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
    ).toBe("/login");
  });

  it("resets its boundary so Project data can be retried", async () => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ProjectDataErrorBoundary resource="the dashboard">
        <FailingProjectDataView error={new Error("database connection failed")} />
      </ProjectDataErrorBoundary>,
    );

    shouldThrow = false;
    screen.getByRole("button", { name: "Try again" }).click();

    await waitFor(() => {
      expect(screen.getByText("Project data loaded")).toBeTruthy();
    });
  });
});
