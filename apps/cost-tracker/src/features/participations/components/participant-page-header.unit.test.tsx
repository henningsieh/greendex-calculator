import { ORPCError } from "@orpc/client";
import { screen } from "@testing-library/react";
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

it("prefetches the participant snapshot behind the page identity", async () => {
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

  expect(mocks.query).toHaveBeenCalledOnce();
  expect(mocks.query).toHaveBeenCalledWith({
    input: { partnershipId: "partnership-1", id: "person-1" },
    meta: { costTrackerORPC: true },
  });
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  // The header owns identity only; breadcrumbs render in the shell slot.
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});

it("prefetches the Partnership snapshot for the coordination route", async () => {
  mocks.query.mockResolvedValue({ projectName: "Workshop" });

  render(
    await ParticipantPageHeader({
      params: Promise.resolve({ partnershipId: "partnership-1" }),
    }),
  );

  expect(mocks.query).toHaveBeenCalledOnce();
  expect(mocks.query).toHaveBeenCalledWith({
    input: { partnershipId: "partnership-1" },
    meta: { costTrackerORPC: true },
  });
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
});

it("retains a static header when the viewer has no active Organization", async () => {
  mocks.query.mockRejectedValue(
    new ORPCError("BAD_REQUEST", {
      data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    }),
  );

  render(
    await ParticipantPageHeader({
      params: Promise.resolve({
        partnershipId: "partnership-1",
        participationId: "person-1",
      }),
    }),
  );

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
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

    expect(mocks.query).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
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
