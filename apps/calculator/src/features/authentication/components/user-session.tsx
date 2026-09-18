"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";

import { HOME_PATH, LOGIN_PATH } from "@/app/routes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/better-auth/auth-client";
import { Link, useRouter } from "@/lib/i18n/routing";
import { orpcQuery } from "@/lib/orpc/orpc";

/**
 * Renders the current user's session controls: a login link when unauthenticated, a user avatar dropdown when authenticated, and a skeleton while signing out.
 *
 * The dropdown shows the user's name, email, and a sign-out action; the avatar displays the user's image when available or computed initials otherwise.
 *
 * @returns The React element for the user session UI based on authentication state.
 */
export function UserSession() {
  const t = useTranslations("authentication.login");
  const router = useRouter();
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

  // Show loading during sign out
  if (isSigningOut) {
    return <UserSessionSkeleton />;
  }

  if (!session) {
    return (
      <div className="flex items-center">
        <Button
          asChild
          /* eslint-disable-next-line shadcn/no-restyle -- Login link spacing is intentional. */
          className="px-2"
          variant="link"
        >
          <Link href={LOGIN_PATH}>{t("loginButton")}</Link>
        </Button>
      </div>
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          /* eslint-disable-next-line shadcn/no-restyle -- User-menu trigger intentionally uses a round hit target. */
          className="relative size-8 rounded-full"
          variant="ghost"
        >
          <Avatar variant="ringed">
            {user.image ? (
              <Image
                alt={user.name || "User avatar"}
                className="rounded-full"
                height={36}
                src={user.image}
                width={36}
              />
            ) : (
              <AvatarFallback>{initials}</AvatarFallback>
            )}
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm leading-none font-medium">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>{t("logOut")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserSessionSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <div className="size-8 animate-pulse rounded-full bg-muted" />
    </div>
  );
}
