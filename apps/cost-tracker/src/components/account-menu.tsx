"use client";

import { useTranslations } from "@greendex/i18n/client";
import { ChevronDownIcon, ChevronUpIcon, LogOutIcon } from "lucide-react";
import { type ComponentProps, useRef } from "react";

import { EntityIcon } from "@/components/entity-icon";
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
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useSignOut } from "@/features/authentication/hooks/use-sign-out";
import { usePathname } from "@/lib/i18n/routing";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

type AccountMenuProps = {
  email: string;
  name: string;
  compact?: boolean;
  /** `sidebar` mirrors the Organization switcher's collapsed-rail behaviour. */
  layout?: "header" | "sidebar";
  /** Stock Button variant; layout-only className may be added separately. */
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
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

/**
 * Signed-in identity dropdown, shared by the shell header and the sidebar
 * footer so both surfaces always show the real session user.
 */
export function AccountMenu({
  compact = false,
  layout = "header",
  email,
  name,
  variant = "outline",
  className,
}: AccountMenuProps) {
  const inSidebar = layout === "sidebar";
  const t = useTranslations("shell");
  const pathname = usePathname();
  const active = pathname === "/user-settings";
  const trigger = useRef<HTMLButtonElement>(null);
  const { pending, signOut, dialog } = useSignOut("/", trigger);

  return (
    <>
      {dialog}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            inSidebar ? (
              <SidebarMenuButton
                ref={trigger}
                data-testid="account-menu-trigger"
                aria-label={t("account.openMenu", { name })}
                size="lg"
                tooltip={name}
              />
            ) : (
              <Button
                ref={trigger}
                data-testid="account-menu-trigger"
                aria-label={compact ? t("account.openMenu", { name }) : undefined}
                className={className}
                size={compact ? "icon-sm" : "sm"}
                variant={variant}
              />
            )
          }
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary"
          >
            {getInitials(name)}
          </span>
          <span
            className={cn(
              "min-w-0",
              inSidebar && "flex-1",
              compact && "sr-only",
              inSidebar && "group-data-[collapsible=icon]:hidden",
            )}
          >
            <span className="block max-w-44 truncate text-sm/5 font-semibold">
              {name}
            </span>
            <span className="block max-w-44 truncate text-xs/4 text-muted-foreground">
              {email}
            </span>
          </span>
          {!compact &&
            (inSidebar ? (
              <ChevronUpIcon
                aria-hidden="true"
                className="ml-auto size-4 group-data-[collapsible=icon]:hidden"
              />
            ) : (
              <ChevronDownIcon aria-hidden="true" />
            ))}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
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
