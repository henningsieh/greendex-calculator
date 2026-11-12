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
import { OrganizationSwitcher } from "@/features/organizations/components/organization-switcher";
import { Link, usePathname } from "@/lib/i18n/routing";

type SidebarNavItem = {
  href: AppRoute;
  label: string;
  testId: string;
  icon: ReactNode;
};

type AppSidebarProps = {
  userName: string;
  userEmail: string;
  showOrganization: boolean;
  showPartnerOrganizations: boolean;
  showOrganizationSwitcher: boolean;
  staffOrganizations: { id: string; name: string }[];
  activeOrganizationId?: string;
};

function isItemActive(pathname: string, href: AppRoute) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNavGroup({
  label,
  items,
}: {
  label: string;
  items: SidebarNavItem[];
}) {
  const pathname = usePathname();

  if (items.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isItemActive(pathname, item.href);

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  aria-current={active ? "page" : undefined}
                  data-testid={item.testId}
                  isActive={active}
                  render={<Link href={item.href} />}
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

  const workspaceItems: SidebarNavItem[] = [
    {
      href: "/projects",
      label: t("nav.projects"),
      testId: "sidebar-nav-projects",
      icon: <EntityIcon entity="project" />,
    },
    {
      href: "/claims/review",
      label: t("nav.claimReview"),
      testId: "sidebar-nav-claim-review",
      icon: <EntityIcon entity="claim" />,
    },
    ...(showPartnerOrganizations
      ? [
          {
            href: "/partner-organizations",
            label: t("nav.partnerOrganizations"),
            testId: "sidebar-nav-partner-organizations",
            icon: <EntityIcon entity="partnerOrganization" />,
          } satisfies SidebarNavItem,
        ]
      : []),
  ];

  const manageItems: SidebarNavItem[] = showOrganization
    ? [
        {
          href: "/organization",
          label: t("nav.organization"),
          testId: "sidebar-nav-organization",
          icon: <EntityIcon entity="organization" />,
        },
      ]
    : [];

  return (
    <Sidebar collapsible="icon">
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
        <SidebarNavGroup label={t("nav.workspace")} items={workspaceItems} />
        <SidebarNavGroup label={t("nav.manage")} items={manageItems} />
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
