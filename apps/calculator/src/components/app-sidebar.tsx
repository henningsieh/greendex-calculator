"use client";

import { useTranslations } from "@greendex/i18n/client";
import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react";
import type { ComponentType } from "react";
import { Suspense } from "react";

import type { AppRoute } from "@/app/routes";
import {
  DASHBOARD_PATH,
  PARTICIPANTS_PATH,
  PROJECTS_ARCHIVE_PATH,
  PROJECTS_PATH,
  SETTINGS_PATH,
  TEAM_PATH,
} from "@/app/routes";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  UserMenu,
  UserMenuSkeleton,
} from "@/features/authentication/components/user-menu";
import {
  OrganizationSwitcher,
  OrganizationSwitcherSkeleton,
} from "@/features/organizations/components/organization-switcher";
import { ORGANIZATION_ICONS } from "@/features/organizations/organization-icons";
import { PROJECT_ICONS } from "@/features/projects/components/project-icons";
import { Link, usePathname } from "@/lib/i18n/routing";

/**
 * Renders the application sidebar containing organization and project navigation.
 *
 * The sidebar groups menu items into "Organization" (Dashboard, Team, Settings)
 * and "Projects" (Projects list, Participants, Archive), highlights the active
 * item based on the current pathname, and provides a collapse toggle in the footer.
 *
 * @returns The Sidebar element with grouped navigation menus, a collapse toggle,
 * and an OrganizationSwitcher wrapped with a skeleton fallback.
 */
// Exported, translation-keyed sidebar group definitions for reuse (breadcrumb, sidebar, etc.)
export const SIDEBAR_GROUP_IDS = ["projects", "archive", "organization"] as const;
export type SidebarGroupId = (typeof SIDEBAR_GROUP_IDS)[number];

export type SidebarMenuItemDef = {
  titleKey: string;
  icon: ComponentType<any>;
  url: AppRoute;
};

export type SidebarGroupDef = {
  id: SidebarGroupId;
  labelKey:
    | "organization.groupLabel"
    | "projects.groupLabel"
    | "projects.archiveLabel";
  items: readonly SidebarMenuItemDef[];
};

export const SIDEBAR_GROUPS: SidebarGroupDef[] = [
  {
    id: "organization",
    labelKey: "organization.groupLabel",
    items: [
      {
        titleKey: "organization.dashboard",
        icon: ORGANIZATION_ICONS.dashboard,
        url: DASHBOARD_PATH,
      },
      {
        titleKey: "organization.team",
        icon: ORGANIZATION_ICONS.team,
        url: TEAM_PATH,
      },
      {
        titleKey: "organization.settings",
        icon: ORGANIZATION_ICONS.organization,
        url: SETTINGS_PATH,
      },
    ],
  },
  {
    id: "projects",
    labelKey: "projects.groupLabel",
    items: [
      {
        titleKey: "projects.projects",
        icon: PROJECT_ICONS.projects,
        url: PROJECTS_PATH,
      },
      {
        titleKey: "projects.participants",
        icon: PROJECT_ICONS.participants,
        url: PARTICIPANTS_PATH,
      },
    ],
  },
  {
    id: "archive",
    labelKey: "projects.archiveLabel",
    items: [
      {
        titleKey: "projects.archive",
        icon: PROJECT_ICONS.archive,
        url: PROJECTS_ARCHIVE_PATH,
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { toggleSidebar, state, openMobile, isMobile, setOpenMobile } =
    useSidebar();

  const t = useTranslations("app.sidebar");

  // Localized view of the shared `SIDEBAR_GROUPS` definitions
  const groups = SIDEBAR_GROUPS.map((g) => ({
    ...g,
    label: t(g.labelKey),
    items: g.items.map((i) => ({ ...i, title: t(i.titleKey) })),
  }));

  const isSidebarOpen = state === "expanded" || (isMobile && openMobile);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <Suspense fallback={<OrganizationSwitcherSkeleton />}>
          <OrganizationSwitcher />
        </Suspense>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <div key={group.label}>
            <SidebarGroup className="overflow-x-hidden">
              <SidebarGroupLabel className="text-nowrap">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem
                      onClick={() => {
                        if (isMobile && openMobile) {
                          setOpenMobile(false);
                        }
                      }}
                      key={item.title}
                    >
                      <SidebarMenuButton
                        asChild
                        variant={
                          group.id === "organization" ? "default" : "secondary"
                        }
                      >
                        <Link data-active={pathname === item.url} href={item.url}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator className="mx-0" />
          </div>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator className="mx-0" />
        <SidebarMenu>
          <SidebarMenuItem onClick={() => toggleSidebar()}>
            <SidebarMenuButton
              className="text-nowrap [&>svg]:size-4"
              variant="outline"
            >
              {isSidebarOpen ? <PanelRightOpenIcon /> : <PanelRightCloseIcon />}
              {t("collapse")}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator className="mx-0" />
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function AppSidebarSkeleton() {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <div className="mb-2 h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
          </div>
        </SidebarGroup>
        <div className="grow" />
        <SidebarGroup>
          <div className="mb-2 h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
          </div>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      </SidebarFooter>
    </Sidebar>
  );
}
