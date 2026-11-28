"use client";

import { useTranslations } from "@greendex/i18n/client";
import type { ReactNode } from "react";

import type { AppHref } from "@/app/routes";
import { AccountMenu } from "@/components/account-menu";
import { AppHeaderRow } from "@/components/app-header-row";
import { LanguageSelector } from "@/components/language-selector";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { UserSummary } from "@/features/authentication/types";

interface AppNavigationProps extends Partial<UserSummary> {
  brandHref?: AppHref;
  actions?: ReactNode;
  leading?: ReactNode;
}

export function AppNavigation({
  email,
  name,
  brandHref = "/",
  actions,
  leading,
}: AppNavigationProps) {
  const t = useTranslations("shell");
  const account = email != null && name != null ? { email, name } : null;

  return (
    <AppHeaderRow brandHref={brandHref} leading={leading}>
      {account ? (
        <div className="flex items-center gap-2">
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
    </AppHeaderRow>
  );
}
