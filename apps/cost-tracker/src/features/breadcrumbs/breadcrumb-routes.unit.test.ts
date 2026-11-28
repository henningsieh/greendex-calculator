import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import {
  navigationForPage,
  sidebarGroups,
} from "@/features/breadcrumbs/breadcrumb-routes";
import { partnershipNavigation } from "@/features/breadcrumbs/partnership-navigation";
import de from "@/messages/de";
import en from "@/messages/en-GB";

const german = createTranslator({
  locale: "de",
  messages: de,
  namespace: "shell",
});
const english = createTranslator({
  locale: "en-GB",
  messages: en,
  namespace: "shell",
});
const organizations = {
  hostOrganizationId: "host",
  partnerOrganizationId: "partner",
};
const hosted = partnershipNavigation(
  "project-42",
  "partnership-7",
  organizations,
  "host",
);
const partner = partnershipNavigation(
  "project-42",
  "partnership-7",
  organizations,
  "partner",
);

describe("protected navigation", () => {
  it.each([
    ["projects", "Arbeitsbereich", "Projekte"],
    ["claims", "Arbeitsbereich", "Anträge"],
    ["partners", "Verwaltung", "Partner"],
    ["settings", "Organisation", "Einstellungen"],
    ["team", "Organisation", "Team"],
    ["account", "Konto", "Kontoeinstellungen"],
  ] as const)(
    "maps %s to its own section and no ancestors",
    (page, eyebrow, current) => {
      expect(navigationForPage(page, german)).toEqual({
        eyebrow,
        breadcrumb: { items: [], current },
      });
    },
  );

  it("keeps the direct partnership route in Administration without a trail", () => {
    expect(navigationForPage("partnership", german, hosted)).toEqual({
      eyebrow: "Verwaltung",
      breadcrumb: null,
    });
  });

  it("distinguishes the project perspectives and uses the workspace group label", () => {
    expect(navigationForPage("project", german, hosted)).toEqual({
      eyebrow: german(sidebarGroups.workspace),
      breadcrumb: {
        items: [
          { label: "Projekte", href: "/projects", testId: "back-to-projects" },
        ],
        current: "Gastgeberprojekt",
      },
    });
    expect(
      navigationForPage("project", english, partner).breadcrumb?.current,
    ).toBe("Partner Project");
  });

  it.each([
    ["participants", hosted, "Hosted Project", "Participants"],
    ["participations", partner, "Partner Project", "Participations"],
    ["participations", hosted, "Hosted Project", "Participations"],
    ["claimReview", hosted, "Hosted Project", "Claim review"],
    ["claim", partner, "Partner Project", "Claim"],
  ] as const)(
    "links %s to its authorized Project",
    (page, context, label, current) => {
      expect(navigationForPage(page, english, context)).toEqual({
        eyebrow: "Workspace",
        breadcrumb: {
          items: [
            { label: "Projects", href: "/projects", testId: "back-to-projects" },
            { label, href: "/projects/project-42" },
          ],
          current,
        },
      });
    },
  );

  it("links a detail to the same Project Partnership from either perspective", () => {
    for (const [context, label] of [
      [hosted, "Gastgeberprojekt"],
      [partner, "Partnerprojekt"],
    ] as const) {
      expect(
        navigationForPage("participation", german, context).breadcrumb,
      ).toEqual({
        items: [
          { label: "Projekte", href: "/projects", testId: "back-to-projects" },
          { label, href: "/projects/project-42" },
          {
            label: "Teilnahmen",
            href: "/partnerships/partnership-7/participants",
            testId: "back-to-participations",
          },
        ],
        current: "Teilnahme",
      });
    }
  });

  it("does not guess a project or partnership destination without authorized context", () => {
    expect(
      partnershipNavigation("foreign", "foreign", organizations, "other"),
    ).toBeUndefined();
    expect(navigationForPage("participation", german).breadcrumb).toEqual({
      items: [
        { label: "Projekte", href: "/projects", testId: "back-to-projects" },
      ],
      current: "Teilnahme",
    });
  });
});
