import { ORPCError } from "@orpc/client";
import { screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@greendex/i18n/server", async () => ({
  getTranslations: (await import("@/__tests__/i18n")).getTranslations,
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    participations: {
      get: { queryOptions: (options: unknown) => options },
      listPartnership: { queryOptions: (options: unknown) => options },
    },
  },
}));
vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: () => ({ query: mocks.query }),
}));

import { ParticipantPageHeader } from "@/features/participations/components/participant-page-header";

beforeEach(() => vi.clearAllMocks());
it("keeps the participant return link and contextual title outside the data view", async () => {
  mocks.query.mockResolvedValue({
    projectName: "Workshop",
    participation: { displayName: "Alex" },
  });
  render(
    await ParticipantPageHeader({
      params: Promise.resolve({
        partnershipId: "partnership-1",
        participationId: "person-1",
      }),
    }),
  );
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  const navigation = screen.getByRole("navigation");
  expect(
    within(navigation)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href")),
  ).toEqual(["/projects", "/partnerships/partnership-1/participants", null]);
  expect(
    within(navigation).getByRole("link", { current: "page" }),
  ).not.toHaveAttribute("href");
});
it.each([undefined, "person-1"])(
  "retains a static header when context is refused (%s)",
  async (participationId) => {
    mocks.query.mockRejectedValue(new ORPCError("FORBIDDEN"));
    render(
      await ParticipantPageHeader({
        params: Promise.resolve({
          partnershipId: "partnership-1",
          participationId,
        }),
      }),
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    const navigation = screen.getByRole("navigation");
    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/projects", null]);
    expect(navigation.querySelectorAll("a")).toHaveLength(1);
  },
);

it("propagates unexpected context failures instead of showing an authorized fallback", async () => {
  const error = new Error("unexpected request failure");
  mocks.query.mockRejectedValue(error);
  await expect(
    ParticipantPageHeader({
      params: Promise.resolve({
        partnershipId: "partnership-1",
        participationId: "person-1",
      }),
    }),
  ).rejects.toBe(error);
});
