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
      "You do not have permission to access this resource.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("shows an HTTP status without exposing remote error details", () => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ProjectDataErrorBoundary resource="Projects">
        <FailingProjectDataView
          error={
            new ORPCError("SERVICE_UNAVAILABLE", {
              message: "database password leaked",
              status: 503,
            })
          }
        />
      </ProjectDataErrorBoundary>,
    );

    expect(screen.getByRole("alert").textContent).toContain("HTTP 503");
    expect(screen.queryByText("database password leaked")).toBeNull();
  });

  it("offers sign-in recovery for an expired oRPC session", () => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ProjectDataErrorBoundary resource="Projects">
        <FailingProjectDataView error={new ORPCError("UNAUTHORIZED")} />
      </ProjectDataErrorBoundary>,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Your session is missing or has expired.",
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

    expect(screen.getByRole("alert").textContent).toContain(
      "The server or network is unreachable.",
    );

    shouldThrow = false;
    screen.getByRole("button", { name: "Retry" }).click();

    await waitFor(() => {
      expect(screen.getByText("Project data loaded")).toBeTruthy();
    });
  });
});
