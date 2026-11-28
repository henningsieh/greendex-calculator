"use client";

import { useTranslations } from "@greendex/i18n/client";

import {
  SectionTabs,
  SectionTabsContent,
  SectionTabsList,
  SectionTabsTrigger,
  SectionTabsWrapper,
} from "@/components/section-tabs";
import type { UserSummary } from "@/features/authentication/types";
import { EditNameForm } from "@/features/user-settings/components/edit-name-form";
import { ThemeSettings } from "@/features/user-settings/components/theme-settings";

type UserSettingsTabsProps = UserSummary;

export function UserSettingsTabs({ email, name }: UserSettingsTabsProps) {
  const t = useTranslations("settings.tabs");

  return (
    <SectionTabsWrapper>
      <SectionTabs defaultValue="account">
        <SectionTabsList aria-label={t("sections")}>
          <SectionTabsTrigger value="account" data-testid="settings-tab-account">
            {t("account")}
          </SectionTabsTrigger>
          <SectionTabsTrigger
            value="appearance"
            data-testid="settings-tab-appearance"
          >
            {t("appearance")}
          </SectionTabsTrigger>
        </SectionTabsList>

        <SectionTabsContent className="mt-8" value="account">
          <SettingsPanel
            description={t("accountDescription")}
            title={t("account")}
          >
            <EditNameForm email={email} name={name} />
          </SettingsPanel>
        </SectionTabsContent>

        <SectionTabsContent className="mt-8" value="appearance">
          <SettingsPanel
            description={t("appearanceDescription")}
            title={t("appearance")}
          >
            <ThemeSettings />
          </SettingsPanel>
        </SectionTabsContent>
      </SectionTabs>
    </SectionTabsWrapper>
  );
}

interface SettingsPanelProps {
  children: React.ReactNode;
  description: string;
  title: string;
}

function SettingsPanel({ children, description, title }: SettingsPanelProps) {
  return (
    <section className="grid gap-7 border-b pb-9 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-12 lg:pb-11">
      <div>
        <h2
          data-testid="settings-panel-heading"
          className="font-heading text-xl font-semibold"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm/6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
