import { partnershipParticipantsPath, projectPath } from "@/app/paths";
import type { AppHref, AppRoute } from "@/app/routes";
import type { ShellMessageKey } from "@/features/breadcrumbs/types";

type ShellTranslator = (key: ShellMessageKey) => string;

export const sidebarGroups = {
  workspace: "nav.workspace",
  management: "nav.manage",
  organization: "nav.organization",
} as const satisfies Record<string, ShellMessageKey>;

type Section = keyof typeof sidebarGroups | "account";

interface PageNavigation {
  section: Section;
  label: ShellMessageKey | null;
  href?: AppRoute;
  parents?: "projects" | "project" | "participations";
}

export const protectedPages = {
  projects: { section: "workspace", label: "nav.projects", href: "/projects" },
  claims: { section: "workspace", label: "nav.claimReview", href: "/claims" },
  partners: {
    section: "management",
    label: "nav.partnerOrganizations",
    href: "/partner-organizations",
  },
  settings: {
    section: "organization",
    label: "nav.settings",
    href: "/organization",
  },
  team: {
    section: "organization",
    label: "nav.team",
    href: "/organization/team",
  },
  account: {
    section: "account",
    label: "account.settings",
    href: "/user-settings",
  },
  project: { section: "workspace", label: null, parents: "projects" },
  participants: {
    section: "workspace",
    label: "crumbs.participants",
    parents: "project",
  },
  participations: {
    section: "workspace",
    label: "crumbs.participations",
    parents: "project",
  },
  participation: {
    section: "workspace",
    label: "crumbs.participation",
    parents: "participations",
  },
  claimReview: {
    section: "workspace",
    label: "crumbs.claimReview",
    parents: "project",
  },
  claim: {
    section: "workspace",
    label: "crumbs.claimWorkspace",
    parents: "project",
  },
  partnership: { section: "management", label: null },
} as const satisfies Record<string, PageNavigation>;

export type ProtectedPage = keyof typeof protectedPages;

export interface ProjectNavigationContext {
  projectId: string;
  relationship: "hosted" | "partner";
  partnershipId?: string;
}

export interface BreadcrumbRouteItem {
  label: string;
  href: AppHref;
  testId?: string;
}

export function navigationForPage(
  page: ProtectedPage,
  t: ShellTranslator,
  context?: ProjectNavigationContext,
) {
  const route: PageNavigation = protectedPages[page];
  const eyebrow = t(
    route.section === "account" ? "account.label" : sidebarGroups[route.section],
  );
  const projectLabel = context
    ? t(
        context.relationship === "hosted"
          ? "crumbs.hostedProject"
          : "crumbs.partnerProject",
      )
    : null;
  const current = route.label
    ? t(route.label)
    : page === "project"
      ? projectLabel
      : null;
  if (!current) return { eyebrow, breadcrumb: null };

  const items: BreadcrumbRouteItem[] = [];
  if (route.parents) {
    items.push({
      label: t(protectedPages.projects.label),
      href: protectedPages.projects.href,
      testId: "back-to-projects",
    });
  }
  if (route.parents && route.parents !== "projects" && context && projectLabel) {
    items.push({ label: projectLabel, href: projectPath(context.projectId) });
  }
  if (route.parents === "participations" && context?.partnershipId) {
    items.push({
      label: t(protectedPages.participations.label),
      href: partnershipParticipantsPath(context.partnershipId),
      testId: "back-to-participations",
    });
  }

  return { eyebrow, breadcrumb: { items, current } };
}
