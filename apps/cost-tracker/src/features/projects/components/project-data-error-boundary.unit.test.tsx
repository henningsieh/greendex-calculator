import { ORPCError } from "@orpc/client";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { createSituationErrors } from "@/lib/orpc/errors";

let shouldThrow = true;

function FailingProjectDataView({ error }: { error: Error }) {
  if (shouldThrow) {
    throw error;
  }

  return <p data-testid="project-data-loaded" />;
}

describe("ProjectDataErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers retry recovery for typed oRPC access errors", () => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ProjectDataErrorBoundary resource="Projects">
        <FailingProjectDataView error={new ORPCError("FORBIDDEN")} />
      </ProjectDataErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("offers retry recovery for an unavailable service", () => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ProjectDataErrorBoundary resource="Projects">
        <FailingProjectDataView
          error={
            new ORPCError("SERVICE_UNAVAILABLE", {
              message: "database password leaked",
            })
          }
        />
      </ProjectDataErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("offers sign-in recovery for an expired oRPC session", () => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ProjectDataErrorBoundary resource="Projects">
        <FailingProjectDataView error={new ORPCError("UNAUTHORIZED")} />
      </ProjectDataErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
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

    expect(screen.getByRole("alert")).toBeInTheDocument();

    shouldThrow = false;
    screen.getByRole("button", { name: "Retry" }).click();

    await waitFor(() => {
      expect(screen.getByTestId("project-data-loaded")).toBeTruthy();
    });
  });
});

it.each([
  createSituationErrors().notMember(),
  createSituationErrors().notFound(),
  createSituationErrors().conflict(),
  createSituationErrors().incompleteProfile(),
  createSituationErrors().invalidCredentials(),
])("non-session $code/$data.reason has retry, not sign-in recovery", (error) => {
  shouldThrow = true;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  render(
    <ProjectDataErrorBoundary resource="Projects">
      <FailingProjectDataView error={error} />
    </ProjectDataErrorBoundary>,
  );
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  vi.restoreAllMocks();
});
