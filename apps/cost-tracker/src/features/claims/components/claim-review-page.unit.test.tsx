import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@greendex/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@greendex/i18n/server")>()),
  getTranslations: (await import("@/__tests__/i18n")).getTranslations,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({}));

const { ReviewContext } =
  await import("@/features/claims/components/claim-review-page");

it.each([
  [
    { projectName: "Spring workshop", organizationName: "Green Routes" },
    "resolved",
  ],
  [undefined, "unavailable"],
] as const)(
  "renders the review context when available (%s)",
  async (details, state) => {
    const { container } = render(await ReviewContext({ details }));
    expect(
      container.querySelector("[data-claim-review-context]"),
    ).toHaveAttribute("data-claim-review-context", state);
  },
);
