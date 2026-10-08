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

  it("shows safe unavailable copy without exposing remote error details", () => {
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

    expect(screen.getByRole("alert").textContent).toContain(
      "The service is temporarily unavailable. Try again later.",
    );
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

it.each([
  [
    createSituationErrors().notMember(),
    "Membership in the active Organization is required.",
  ],
  [createSituationErrors().notFound(), "Resource not found in scope."],
  [
    createSituationErrors().conflict(),
    "The resource state conflicts with this request. Reload and try again.",
  ],
  [
    createSituationErrors().incompleteProfile(),
    "Complete your Participant profile before accessing Projects.",
  ],
  [createSituationErrors().invalidCredentials(), "Incorrect email or password."],
])(
  "non-session $code/$data.reason has retry, not sign-in recovery",
  (error, text) => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ProjectDataErrorBoundary resource="Projects">
        <FailingProjectDataView error={error} />
      </ProjectDataErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain(text);
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    vi.restoreAllMocks();
  },
);
