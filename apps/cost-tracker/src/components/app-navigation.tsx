"use client";

import {
  Building2Icon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { SiteBrand } from "@/components/site-brand";
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
          <SessionLink compact email={email} name={name} pathname={pathname} />
          <SignOutButton compact />
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

        <div className="hidden shrink-0 items-center gap-2 pb-2 lg:flex">
          <SessionLink email={email} name={name} pathname={pathname} />
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

type SessionLinkProps = AppNavigationProps & {
  compact?: boolean;
  pathname: string;
};

function SessionLink({
  compact = false,
  email,
  name,
  pathname,
}: SessionLinkProps) {
  const active = pathname === "/user-settings";

  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={compact ? `User settings for ${name}` : undefined}
      className={cn(
        "flex min-w-0 items-center gap-3 border px-3 py-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
        active && "bg-muted",
        compact && "size-9 justify-center p-0",
      )}
      href="/user-settings"
    >
      <UserRoundIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className={cn("min-w-0", compact && "sr-only")}>
        <span className="block max-w-44 truncate text-sm font-medium">
          {name}
        </span>
        <span className="block max-w-44 truncate text-xs text-muted-foreground">
          {email}
        </span>
      </span>
    </Link>
  );
}
