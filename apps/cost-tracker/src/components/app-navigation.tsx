"use client";

import {
  Building2Icon,
  ChevronDownIcon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SiteBrand } from "@/components/site-brand";
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
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/dashboard", icon: LayoutDashboardIcon, label: "Overview" },
  { href: "/projects", icon: FolderKanbanIcon, label: "Projects" },
  {
    href: "/partner-organizations",
    icon: Building2Icon,
    label: "Partner organizations",
  },
];

type AppNavigationProps = {
  email: string;
  name: string;
};

export function AppNavigation({ email, name }: AppNavigationProps) {
  const pathname = usePathname();

  return (
    <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
      <div className="flex h-18 items-center justify-between">
        <SiteBrand href="/dashboard" />
        <div className="flex items-center gap-2 lg:hidden">
          <AccountMenu compact email={email} name={name} pathname={pathname} />
        </div>
      </div>

      <div className="flex min-w-0 items-end justify-between gap-6">
        <nav
          aria-label="Primary navigation"
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
                {item.label}
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
  const active = pathname === "/user-settings";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={compact ? `Open account menu for ${name}` : undefined}
            className={cn(
              "group h-11 gap-3 rounded-lg px-2.5 text-left tracking-normal normal-case hover:bg-muted/70",
              active && "bg-muted",
              compact &&
                "size-9 justify-center rounded-full bg-primary/10 p-0 hover:bg-primary/20",
            )}
            size={compact ? "icon-sm" : "sm"}
            variant="ghost"
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
          <span className="block max-w-44 truncate text-sm leading-5 font-semibold">
            {name}
          </span>
          <span className="block max-w-44 truncate text-xs leading-4 text-muted-foreground">
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
            Account settings
          </DropdownMenuItem>
          <DropdownMenuItem
            className="rounded-md p-0 text-sm tracking-normal normal-case"
            render={
              <SignOutButton className="h-9 w-full justify-start rounded-md px-3 text-sm tracking-normal text-destructive normal-case hover:bg-destructive/10 hover:text-destructive" />
            }
            variant="destructive"
          />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
