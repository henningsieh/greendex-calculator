"use client";

/* eslint-disable shadcn/no-restyle -- Account-menu bespoke treatments: none of the shared Button/DropdownMenu variants provide this screen's exact shape, spacing, typography, and color. Zero visual change intended; revisit with a variant if the pattern repeats. */

import { useTranslations } from "@greendex/i18n/client";
import {
  Building2Icon,
  ChevronDownIcon,
  FolderKanbanIcon,
  LogOutIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

import { SiteBrand } from "@/components/site-brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/features/authentication/hooks/use-sign-out";
import { OrganizationSwitcher } from "@/features/organizations/components/organization-switcher";
import { cn } from "@/lib/utils";

const baseNavigationItems = [
  { href: "/projects", icon: FolderKanbanIcon, labelKey: "nav.projects" },
] as const;

const partnerOrganizationsNavigationItem = {
  href: "/partner-organizations",
  icon: Building2Icon,
  labelKey: "nav.partnerOrganizations",
} as const;

const organizationNavigationItem = {
  href: "/organization",
  icon: UsersIcon,
  labelKey: "nav.organization",
} as const;

type AppNavigationProps = {
  email: string;
  name: string;
  showOrganization?: boolean;
  showPartnerOrganizations?: boolean;
  showOrganizationSwitcher?: boolean;
  staffOrganizations?: { id: string; name: string }[];
  activeOrganizationId?: string;
};

export function AppNavigation({
  email,
  name,
  showOrganization = false,
  showPartnerOrganizations = true,
  showOrganizationSwitcher = false,
  staffOrganizations = [],
  activeOrganizationId,
}: AppNavigationProps) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  // Presentation-only: each page and its procedures gate access. The Partner
  // Organizations tab hides for people who cannot use that page.
  const navigationItems = [
    ...(showOrganization ? [organizationNavigationItem] : []),
    ...baseNavigationItems,
    ...(showPartnerOrganizations ? [partnerOrganizationsNavigationItem] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
      <div className="flex h-18 items-center justify-between">
        <SiteBrand href="/projects" />
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          {showOrganizationSwitcher && activeOrganizationId ? (
            <OrganizationSwitcher
              activeOrganizationId={activeOrganizationId}
              organizations={staffOrganizations}
            />
          ) : null}
          <div className="lg:hidden">
            <AccountMenu compact email={email} name={name} pathname={pathname} />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-end justify-between gap-6">
        <nav
          aria-label={t("nav.primaryLabel")}
          className="-ml-2 flex min-w-0 overflow-x-auto sm:-ml-3"
        >
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 px-2 py-4 text-sm font-medium transition-colors sm:px-3",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" className="hidden size-4 sm:block" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 pb-2 lg:block">
          <AccountMenu email={email} name={name} pathname={pathname} />
        </div>
      </div>
    </div>
  );
}

type AccountMenuProps = AppNavigationProps & {
  compact?: boolean;
  pathname: string;
};

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "?";
}

function AccountMenu({
  compact = false,
  email,
  name,
  pathname,
}: AccountMenuProps) {
  const t = useTranslations("shell");
  const tAuth = useTranslations("onboarding");
  const active = pathname === "/user-settings";
  const trigger = useRef<HTMLButtonElement>(null);
  const { pending, signOut, dialog } = useSignOut("/", trigger);

  return (
    <>
      {dialog}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              ref={trigger}
              data-testid="account-menu-trigger"
              aria-label={compact ? t("account.openMenu", { name }) : undefined}
              className={cn(
                "group h-11 gap-3 rounded-lg px-2.5 text-left tracking-normal normal-case hover:bg-muted/70",
                active && "bg-muted",
                compact &&
                  "size-9 justify-center rounded-full bg-primary/10 p-0 hover:bg-primary/20",
              )}
              size={compact ? "icon-sm" : "sm"}
              variant="outline"
            />
          }
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary"
          >
            {getInitials(name)}
          </span>
          <span className={cn("min-w-0", compact && "sr-only")}>
            <span className="block max-w-44 truncate text-sm/5 font-semibold">
              {name}
            </span>
            <span className="block max-w-44 truncate text-xs/4 text-muted-foreground">
              {email}
            </span>
          </span>
          {!compact && <ChevronDownIcon aria-hidden="true" />}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64 rounded-xl p-2">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-3 py-2">
              <span className="block truncate text-sm font-semibold text-foreground">
                {name}
              </span>
              <span className="block truncate text-xs font-normal tracking-normal text-muted-foreground normal-case">
                {email}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="rounded-md text-sm tracking-normal normal-case"
              render={
                <Link
                  aria-current={active ? "page" : undefined}
                  href="/user-settings"
                />
              }
            >
              {t("account.settings")}
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="account-menu-sign-out"
              disabled={pending}
              onClick={() => void signOut()}
              variant="destructive"
            >
              <LogOutIcon />
              {tAuth(pending ? "auth.confirmSignOut.pending" : "auth.signOut")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
