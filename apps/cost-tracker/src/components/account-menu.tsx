"use client";

/* eslint-disable shadcn/no-restyle -- Account-menu bespoke treatments: none of the shared Button/DropdownMenu variants provide this screen's exact shape, spacing, typography, and color. Zero visual change intended; revisit with a variant if the pattern repeats. */

import { useTranslations } from "@greendex/i18n/client";
import { ChevronDownIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { useSignOut } from "@/features/authentication/hooks/use-sign-out";
import { cn } from "@/lib/utils";

type AccountMenuProps = {
  email: string;
  name: string;
  compact?: boolean;
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
  email,
  name,
  variant = "outline",
  className,
}: AccountMenuProps) {
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
            <Button
              ref={trigger}
              data-testid="account-menu-trigger"
              aria-label={compact ? t("account.openMenu", { name }) : undefined}
              className={cn(
                "group h-11 gap-3 rounded-md px-2.5 text-left tracking-normal normal-case hover:bg-muted/70",
                active && "bg-muted",
                compact &&
                  "size-9 justify-center rounded-full bg-primary/10 p-0 hover:bg-primary/20",
                className,
              )}
              size={compact ? "icon-sm" : "sm"}
              variant={variant}
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
