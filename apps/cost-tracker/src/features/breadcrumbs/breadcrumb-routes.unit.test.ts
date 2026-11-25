import { describe, expect, it } from "vitest";

import { breadcrumbForPath } from "@/features/breadcrumbs/breadcrumb-routes";
import type { ShellMessageKey } from "@/features/breadcrumbs/types";

const t = (key: ShellMessageKey) => key;

describe("breadcrumbForPath", () => {
  it("has no parent crumbs on the Projects register", () => {
    expect(breadcrumbForPath("/projects", t)).toEqual({
      items: [],
      current: "nav.projects",
    });
  });

  it("links the Project detail crumb back to the register", () => {
    expect(breadcrumbForPath("/projects/project-1", t)).toEqual({
      items: [
        {
          label: "nav.projects",
          href: "/projects",
          testId: "back-to-projects",
        },
      ],
      current: "crumbs.projectDetails",
    });
  });

  it("keeps the Project crumb linked on its Participants page", () => {
    expect(breadcrumbForPath("/projects/project-1/participants", t)).toEqual({
      items: [
        {
          label: "nav.projects",
          href: "/projects",
          testId: "back-to-projects",
        },
        { label: "crumbs.projectDetails", href: "/projects/project-1" },
      ],
      current: "crumbs.participants",
    });
  });

  it("uses the Partnership crumb for Claim review instead of a Project query", () => {
    expect(
      breadcrumbForPath("/partnerships/partnership-1/claim/review", t),
    ).toEqual({
      items: [
        {
          label: "nav.projects",
          href: "/projects",
          testId: "back-to-projects",
        },
        { label: "crumbs.partnership", href: "/partnerships/partnership-1" },
      ],
      current: "crumbs.claimReview",
    });
  });

  it("keeps Participation details under its Partnership and Participants crumbs", () => {
    expect(
      breadcrumbForPath(
        "/partnerships/partnership-1/participants/participation-1",
        t,
      ),
    ).toEqual({
      items: [
        {
          label: "nav.projects",
          href: "/projects",
          testId: "back-to-projects",
        },
        { label: "crumbs.partnership", href: "/partnerships/partnership-1" },
        {
          label: "crumbs.participants",
          href: "/partnerships/partnership-1/participants",
        },
      ],
      current: "crumbs.participantDetails",
    });
  });

  it.each([
    ["/claims", "nav.claimReview"],
    ["/partner-organizations", "nav.partnerOrganizations"],
    ["/organization", "nav.organization"],
    ["/user-settings", "crumbs.userSettings"],
  ])("renders %s as a single leaf crumb", (pathname, current) => {
    expect(breadcrumbForPath(pathname, t)).toEqual({ items: [], current });
  });

  it("decodes a path segment before rebuilding the link", () => {
    const { items } = breadcrumbForPath("/projects/a%20b/participants", t);
    expect(items[1]?.href).toBe("/projects/a%20b");
  });
});
