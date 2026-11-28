"use client";

import { useTranslations } from "@greendex/i18n/client";
import type { ReactNode } from "react";

import type { AppRoute } from "@/app/routes";
import { AccountMenu } from "@/components/account-menu";
import { EntityIcon } from "@/components/entity-icon";
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
} from "@/components/ui/sidebar";
import {
  protectedPages,
  sidebarGroups,
} from "@/features/breadcrumbs/breadcrumb-routes";
import { OrganizationSwitcher } from "@/features/organizations/components/organization-switcher";
import { Link, usePathname } from "@/lib/i18n/routing";
import {
  persistentViewTransitionName,
  viewTransitionType,
} from "@/lib/view-transitions";

interface SidebarNavItem {
  href: AppRoute;
  label: string;
  testId: string;
  icon: ReactNode;
  matchChildren: boolean;
}

interface AppSidebarProps {
  userName: string;
  userEmail: string;
  showOrganization: boolean;
  showPartnerOrganizations: boolean;
  showOrganizationSwitcher: boolean;
  staffOrganizations: { id: string; name: string }[];
  activeOrganizationId?: string;
}

function isItemActive(pathname: string, item: SidebarNavItem) {
  return (
    pathname === item.href ||
    (item.matchChildren && pathname.startsWith(`${item.href}/`))
  );
}

function SidebarNavGroup({
  section,
  label,
  items,
}: {
  section: string;
  label: string;
  items: SidebarNavItem[];
}) {
  const pathname = usePathname();

  if (items.length === 0) return null;

  return (
    <SidebarGroup data-navigation-section={section}>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isItemActive(pathname, item);

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  aria-current={pathname === item.href ? "page" : undefined}
                  data-testid={item.testId}
                  isActive={active}
                  render={
                    <Link
                      href={item.href}
                      transitionTypes={[viewTransitionType.forward]}
                    />
                  }
                  tooltip={item.label}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({
  userName,
  userEmail,
  showOrganization,
  showPartnerOrganizations,
  showOrganizationSwitcher,
  staffOrganizations,
  activeOrganizationId,
}: AppSidebarProps) {
  const t = useTranslations("shell");
  const activeOrganization = staffOrganizations.find(
    (organization) => organization.id === activeOrganizationId,
  );

  const entries = [
    {
      page: protectedPages.projects,
      icon: "project",
      testId: "sidebar-nav-projects",
      visible: true,
    },
    {
      page: protectedPages.claims,
      icon: "claim",
      testId: "sidebar-nav-claim-review",
      visible: true,
    },
    {
      page: protectedPages.partners,
      icon: "partner",
      testId: "sidebar-nav-partner-organizations",
      visible: showPartnerOrganizations,
    },
    {
      matchChildren: false,
      page: protectedPages.settings,
      icon: "organization",
      testId: "sidebar-nav-organization",
      visible: showOrganization,
    },
    {
      page: protectedPages.team,
      icon: "participants",
      testId: "sidebar-nav-team",
      visible: showOrganization,
    },
  ] as const;

  return (
    <Sidebar
      collapsible="icon"
      style={{
        viewTransitionName: persistentViewTransitionName.appSidebar,
      }}
    >
      <SidebarHeader>
        {showOrganizationSwitcher && activeOrganizationId ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <OrganizationSwitcher
                activeOrganizationId={activeOrganizationId}
                layout="sidebar"
                organizations={staffOrganizations}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip={activeOrganization?.name ?? t("nav.organization")}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <EntityIcon entity="organization" className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm/tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">
                    {activeOrganization?.name ?? t("nav.organization")}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarHeader>
      <SidebarContent>
        {Object.entries(sidebarGroups).map(([section, label]) => (
          <SidebarNavGroup
            key={section}
            section={section}
            label={t(label)}
            items={entries.flatMap(
              ({ page, icon, testId, visible, ...options }) =>
                visible && page.section === section
                  ? [
                      {
                        href: page.href,
                        matchChildren:
                          "matchChildren" in options
                            ? options.matchChildren
                            : true,
                        label: t(page.label),
                        testId,
                        icon: <EntityIcon entity={icon} />,
                      },
                    ]
                  : [],
            )}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountMenu email={userEmail} layout="sidebar" name={userName} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
