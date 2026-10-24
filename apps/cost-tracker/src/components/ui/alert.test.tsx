import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

type AlertProps = ComponentProps<typeof Alert>;

const variants = [
  "default",
  "destructive",
  "accent",
  "info",
] as const satisfies readonly AlertProps["variant"][];
const emphases = [
  "default",
  "prominent",
] as const satisfies readonly AlertProps["emphasis"][];

function AlertContent() {
  return (
    <>
      <svg aria-hidden="true" data-testid="alert-icon" />
      <AlertTitle id="fixture-title" data-testid="alert-title">
        Fixture title
      </AlertTitle>
      <AlertDescription id="fixture-description" data-testid="alert-description">
        <p data-testid="alert-content">{"long-address".repeat(20)}@example.org</p>
      </AlertDescription>
      <AlertAction data-testid="alert-action">
        <a href="/fixture-destination">Fixture action</a>
      </AlertAction>
    </>
  );
}

describe("Alert", () => {
  describe.each(variants)("variant %s", (variant) => {
    it.each(emphases)(
      "composes content with %s emphasis without changing urgency",
      (emphasis) => {
        render(
          <Alert
            variant={variant}
            emphasis={emphasis}
            aria-labelledby="fixture-title"
            aria-describedby="fixture-description"
          >
            <AlertContent />
          </Alert>,
        );

        const alert = screen.getByRole(variant === "info" ? "status" : "alert");
        expect(alert).toHaveAccessibleName("Fixture title");
        expect(alert).toHaveAccessibleDescription(
          `${"long-address".repeat(20)}@example.org`,
        );
        expect(alert).toContainElement(screen.getByTestId("alert-icon"));
        expect(alert).toContainElement(screen.getByTestId("alert-title"));
        expect(alert).toContainElement(screen.getByTestId("alert-description"));
        expect(alert).toContainElement(screen.getByTestId("alert-action"));
        expect(
          within(screen.getByTestId("alert-action")).getByRole("link"),
        ).toHaveAttribute("href", "/fixture-destination");
        expect(alert).not.toHaveAttribute("aria-live");
      },
    );
  });

  it.each([undefined, null, "default", "destructive", "accent"] as const)(
    "preserves existing urgent semantics for variant %s without opting into emphasis",
    (variant) => {
      render(
        <Alert variant={variant} data-testid="legacy-alert">
          <AlertContent />
        </Alert>,
      );

      expect(screen.getByTestId("legacy-alert")).toHaveRole("alert");
      expect(within(screen.getByRole("alert")).getByRole("link")).toHaveAttribute(
        "href",
        "/fixture-destination",
      );
    },
  );

  it.each(variants)(
    "allows caller-controlled status semantics for %s",
    (variant) => {
      render(
        <Alert
          variant={variant}
          emphasis="prominent"
          role="status"
          aria-live="off"
          aria-atomic="false"
        />,
      );

      const alert = screen.getByRole("status");
      expect(alert).toHaveAttribute("aria-live", "off");
      expect(alert).toHaveAttribute("aria-atomic", "false");
    },
  );

  it("allows an informational message to opt into an urgent announcement explicitly", () => {
    render(<Alert variant="info" role="alert" />);

    expect(screen.getByRole("alert")).toHaveRole("alert");
  });

  it("keeps supplied actions keyboard accessible", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <Alert variant="info" emphasis="prominent">
        <AlertTitle>Fixture title</AlertTitle>
        <AlertDescription>Fixture description</AlertDescription>
        <AlertAction>
          <button type="button" onClick={() => onAction("continue")}>
            Fixture action
          </button>
          <a href="/fixture-destination">Fixture link</a>
        </AlertAction>
      </Alert>,
    );

    const status = screen.getByRole("status");
    const button = within(status).getByRole("button");
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledExactlyOnceWith("continue");
    await user.tab();
    expect(within(status).getByRole("link")).toHaveFocus();
    expect(within(status).getByRole("link")).toHaveAttribute(
      "href",
      "/fixture-destination",
    );
  });

  it("supports content without an icon, title, or actions", () => {
    render(
      <Alert variant="info">
        <AlertDescription data-testid="standalone-content">
          Fixture content
        </AlertDescription>
      </Alert>,
    );

    expect(screen.getByRole("status")).toContainElement(
      screen.getByTestId("standalone-content"),
    );
  });
});
