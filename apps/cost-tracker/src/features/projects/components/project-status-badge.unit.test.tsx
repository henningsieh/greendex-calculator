import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithMessages } from "@/__tests__/render-with-messages";
import {
  ProjectArchiveBadge,
  ProjectStatusBadge,
} from "@/features/projects/components/project-status-badge";

describe("Project status badges", () => {
  it.each([
    ["open", "status-attention"],
    ["ready", "status-success"],
    ["archived", "secondary"],
  ] as const)("renders %s", (status, variant) => {
    renderWithMessages(<ProjectStatusBadge status={status} />);
    expect(screen.getByTestId("project-status")).toHaveAttribute(
      "data-variant",
      variant,
    );
    expect(screen.getByTestId("project-status")).toHaveAttribute(
      "data-status",
      status,
    );
  });

  it("uses the same archived presentation for archive-only records", () => {
    renderWithMessages(
      <>
        <ProjectArchiveBadge status="archived" />
        <ProjectStatusBadge status="archived" />
      </>,
    );
    expect(screen.getByTestId("project-archived-status")).toHaveAttribute(
      "data-project-archive-status",
      "archived",
    );
    expect(screen.getByTestId("project-archived-status")).toHaveAttribute(
      "data-variant",
      "secondary",
    );
  });
});
