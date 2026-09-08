"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronDownIcon, LogOutIcon, SettingsIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { HOME_PATH, LOGIN_PATH, USER_SETTINGS_PATH } from "@/app/routes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/better-auth/auth-client";
import { Link, useRouter } from "@/lib/i18n/routing";
import { orpcQuery } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const t = useTranslations("authentication.login");
  const router = useRouter();
  const { isMobile, state } = useSidebar();

  const { data: session } = useSuspenseQuery(
    orpcQuery.betterauth.getSession.queryOptions(),
  );

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await authClient.signOut();
    router.push(HOME_PATH);
    router.refresh();
  };

  if (isSigningOut) {
    return <UserMenuSkeleton />;
  }

  if (!session) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href={LOGIN_PATH}>{t("loginButton")}</Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const user = session.user;
  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || user.email[0].toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className={cn(
                "border border-sidebar-accent/60 ring-sidebar-accent",
                "hover:bg-sidebar-primary/40 hover:text-sidebar-foreground",
                "data-[state=open]:bg-sidebar-primary/30 data-[state=open]:text-sidebar-foreground/60",
              )}
              size="lg"
            >
              <Avatar className="size-8 rounded-md ring-1 ring-border">
                {user.image ? (
                  <Image
                    alt={user.name}
                    height={32}
                    src={user.image}
                    width={32}
                  />
                ) : (
                  <AvatarFallback>{initials}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="text-sm font-medium text-nowrap">
                  {user.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <ChevronDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn(
              "border border-sidebar-accent/50 bg-background/80 backdrop-blur-md",
              state === "expanded" && "w-(--radix-dropdown-menu-trigger-width)",
              state === "collapsed" && "w-72",
            )}
            side={isMobile ? undefined : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm leading-none font-medium">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* User Settings */}
            <DropdownMenuItem asChild>
              <Link href={USER_SETTINGS_PATH}>
                <SettingsIcon className="mr-2 size-4" />
                <span>{t("settings")}</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOutIcon className="mr-2 size-4" />
              {t("logOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function UserMenuSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
