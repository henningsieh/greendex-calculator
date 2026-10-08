// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, expect, it, vi } from "vitest";

const labels: Record<string, string> = {
  "participant-journey": "Participant Journey",
  "round-trip": "Round trip",
  "one-way": "One way",
};
const mocks = vi.hoisted(() => ({
  hasUser: true,
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
        displayName: "Participation Display Name",
        email: "participation@example.com",
        user: mocks.hasUser
          ? {
              name: "Login Display Name",
              email: "login@example.com",
              image: null,
            }
          : null,
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
  expect(withoutJourney).toContain("Participation Display Name");
  expect(withoutJourney).not.toContain("Participant Journey");
});

it.each([true, false])(
  "renders Participation-owned name and email with linked User = %s",
  (hasUser) => {
    mocks.hasUser = hasUser;
    mocks.journey = {
      origin: "Paris",
      destination: "Berlin",
      tripType: "round-trip",
      erasmusDistanceKm: "878.00",
    };
    const html = renderToStaticMarkup(
      <ParticipantsList activeProjectId="project" />,
    );
    expect(html).toContain("Participation Display Name");
    expect(html).toContain("participation@example.com");
    expect(html).toContain("Participant Journey");
    expect(html).not.toContain("Login Display Name");
    expect(html).not.toContain("login@example.com");
    mocks.hasUser = true;
    mocks.journey = null;
  },
);

afterAll(() => {
  vi.doUnmock("@greendex/i18n/client");
  vi.doUnmock("@tanstack/react-query");
  vi.doUnmock("@/lib/orpc/orpc");
  vi.resetModules();
});
