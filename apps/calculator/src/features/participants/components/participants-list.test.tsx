// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, expect, it, vi } from "vitest";

const labels: Record<string, string> = {
  "participant-journey": "Participant Journey",
  "round-trip": "Round trip",
  "one-way": "One way",
};
const mocks = vi.hoisted(() => ({
  journey: null as null | {
    origin: string;
    destination: string;
    tripType: "round-trip";
    erasmusDistanceKm: string;
  },
}));
vi.mock("@greendex/i18n/client", () => ({
  useFormatter: () => ({
    dateTime: () => "Oct 8, 2026",
    number: (value: number) => String(value),
  }),
  useTranslations: () => (key: string) => labels[key] ?? key,
}));
vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({
    data: [
      {
        id: "participant",
        user: {
          name: "Shared Participant",
          email: "participant@example.com",
          image: null,
        },
        createdAt: new Date("2026-10-08"),
        journey: mocks.journey,
      },
    ],
  }),
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: { projects: { getParticipants: { queryOptions: () => ({}) } } },
}));

import { ParticipantsList } from "./participants-list";

it("displays the canonical Participant Journey beside its Participant without pretending it is carbon travel data", () => {
  mocks.journey = {
    origin: "Paris",
    destination: "Berlin",
    tripType: "round-trip",
    erasmusDistanceKm: "878.00",
  };
  const html = renderToStaticMarkup(
    <ParticipantsList activeProjectId="project" />,
  );
  expect(html).toContain("Participant Journey");
  expect(html).toContain("Paris");
  expect(html).toContain("Berlin");
  expect(html).toContain("Round trip");
  expect(html).toContain("878");
  mocks.journey = null;
  const withoutJourney = renderToStaticMarkup(
    <ParticipantsList activeProjectId="project" />,
  );
  expect(withoutJourney).toContain("Shared Participant");
  expect(withoutJourney).not.toContain("Participant Journey");
});

afterAll(() => {
  vi.doUnmock("@greendex/i18n/client");
  vi.doUnmock("@tanstack/react-query");
  vi.doUnmock("@/lib/orpc/orpc");
  vi.resetModules();
});
