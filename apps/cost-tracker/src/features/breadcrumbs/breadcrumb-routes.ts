import {
  partnershipParticipantsPath,
  partnershipPath,
  projectPath,
} from "@/app/paths";
import type { AppHref } from "@/app/routes";
import type { ShellMessageKey } from "@/features/breadcrumbs/types";

type ShellTranslator = (key: ShellMessageKey) => string;

export interface BreadcrumbRouteItem {
  label: string;
  href?: AppHref;
  testId?: string;
}

export interface BreadcrumbRoute {
  items: BreadcrumbRouteItem[];
  current: string;
}

/**
 * Pure breadcrumb derivation for every protected route.
 *
 * Labels are static by design (no entity names), so the trail can be derived
 * from the pathname alone. That is what keeps navigation smooth: the trail
 * updates in the same commit as the route, without a request-time query, a
 * Suspense fallback, or a full breadcrumb reload.
 */
export function breadcrumbForPath(
  pathname: string,
  t: ShellTranslator,
): BreadcrumbRoute {
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });

  const projects: BreadcrumbRouteItem = {
    label: t("nav.projects"),
    href: "/projects",
    testId: "back-to-projects",
  };

  const [root, first, second, third] = segments;

  switch (root) {
    case "projects": {
      if (!first) return { items: [], current: t("nav.projects") };
      const project: BreadcrumbRouteItem = {
        label: t("crumbs.projectDetails"),
        href: projectPath(first),
      };
      if (second === "participants") {
        return {
          items: [projects, project],
          current: t("crumbs.participants"),
        };
      }
      return { items: [projects], current: t("crumbs.projectDetails") };
    }
    case "partnerships": {
      if (!first) return { items: [projects], current: t("crumbs.partnership") };
      const partnership: BreadcrumbRouteItem = {
        label: t("crumbs.partnership"),
        href: partnershipPath(first),
      };
      if (second === "claim" && third === "review") {
        return {
          items: [projects, partnership],
          current: t("crumbs.claimReview"),
        };
      }
      if (second === "claim") {
        return {
          items: [projects, partnership],
          current: t("crumbs.claimWorkspace"),
        };
      }
      if (second === "participants" && third) {
        return {
          items: [
            projects,
            partnership,
            {
              label: t("crumbs.participants"),
              href: partnershipParticipantsPath(first),
            },
          ],
          current: t("crumbs.participantDetails"),
        };
      }
      if (second === "participants") {
        return {
          items: [projects, partnership],
          current: t("crumbs.participants"),
        };
      }
      return { items: [projects], current: t("crumbs.partnership") };
    }
    case "claims":
      return { items: [], current: t("nav.claimReview") };
    case "partner-organizations":
      return { items: [], current: t("nav.partnerOrganizations") };
    case "organization":
      return { items: [], current: t("nav.organization") };
    case "user-settings":
      return { items: [], current: t("crumbs.userSettings") };
    default:
      return { items: [], current: t("nav.projects") };
  }
}
