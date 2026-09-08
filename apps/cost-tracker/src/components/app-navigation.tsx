"use client";

import {
  Building2Icon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
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
    <div className="flex flex-col border-b bg-background lg:flex-row lg:items-center lg:justify-between">
      <nav
        aria-label="Primary navigation"
        className="flex overflow-x-auto px-4 sm:px-6"
      >
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 py-4 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden="true" className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden items-center gap-4 px-6 lg:flex">
        <div className="max-w-48 text-right">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
