"use client";

/* eslint-disable shadcn/no-restyle -- Account-menu bespoke treatments: none of the shared Button/DropdownMenu variants provide this screen's exact shape, spacing, typography, and color. Zero visual change intended; revisit with a variant if the pattern repeats. */

import { useTranslations } from "@greendex/i18n/client";
import { ChevronDownIcon, LogOutIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRef } from "react";

import { EntityIcon } from "@/components/entity-icon";
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
import { cn } from "@/lib/utils";

type AppNavigationProps = {
  email?: string;
  name?: string;
  brandHref?: Route;
  actions?: ReactNode;
};

export function AppNavigation({
  email,
  name,
  brandHref = "/",
  actions,
}: AppNavigationProps) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const account = email != null && name != null ? { email, name } : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
      <div className="flex h-18 items-center justify-between">
        <SiteBrand href={brandHref} />
        {account ? (
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <div className="lg:hidden">
              <AccountMenu
                compact
                email={account.email}
                name={account.name}
                pathname={pathname}
              />
            </div>
            <div className="hidden lg:block">
              <AccountMenu
                email={account.email}
                name={account.name}
                pathname={pathname}
              />
            </div>
          </div>
        ) : (
          <nav
            aria-label={t("landing.accountNav")}
            className="flex items-center gap-2 sm:gap-3"
          >
            <ThemeSwitcher />
            {actions}
          </nav>
        )}
      </div>
    </div>
  );
}

type AccountMenuProps = {
  email: string;
  name: string;
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
                "group h-11 gap-3 rounded-md px-2.5 text-left tracking-normal normal-case hover:bg-muted/70",
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
              <EntityIcon entity="account" />
              {t("account.settings")}
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="account-menu-sign-out"
              disabled={pending}
              onClick={() => void signOut()}
              variant="destructive"
            >
              <LogOutIcon />
              {t(pending ? "account.signingOut" : "account.signOut")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
