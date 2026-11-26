"use client";

import { useTranslations } from "@greendex/i18n/client";
import type { ReactNode } from "react";

import type { AppHref } from "@/app/routes";
import { AccountMenu } from "@/components/account-menu";
import { LanguageSelector } from "@/components/language-selector";
import { SiteBrand } from "@/components/site-brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { UserSummary } from "@/features/authentication/types";
import { NotificationBell } from "@/features/notifications/components/notification-bell";

interface AppNavigationProps extends Partial<UserSummary> {
  brandHref?: AppHref;
  actions?: ReactNode;
  realtimeUrl?: string;
}

export function AppNavigation({
  email,
  name,
  brandHref = "/",
  actions,
  realtimeUrl,
}: AppNavigationProps) {
  const t = useTranslations("shell");
  const account = email != null && name != null ? { email, name } : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
      <div className="flex h-18 items-center justify-between">
        <SiteBrand href={brandHref} />
        {account ? (
          <div className="flex items-center gap-2">
            <NotificationBell realtimeUrl={realtimeUrl} />
            <ThemeSwitcher />
            <LanguageSelector />
            <div className="lg:hidden">
              <AccountMenu compact email={account.email} name={account.name} />
            </div>
            <div className="hidden lg:block">
              <AccountMenu email={account.email} name={account.name} />
            </div>
          </div>
        ) : (
          <nav
            aria-label={t("landing.accountNav")}
            className="flex items-center gap-2 sm:gap-3"
          >
            <ThemeSwitcher />
            <LanguageSelector />
            {actions}
          </nav>
        )}
      </div>
    </div>
  );
}
