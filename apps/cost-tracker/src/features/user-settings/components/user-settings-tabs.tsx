"use client";

import { useTranslations } from "@greendex/i18n/client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditNameForm } from "@/features/user-settings/components/edit-name-form";
import { ThemeSettings } from "@/features/user-settings/components/theme-settings";

type UserSettingsTabsProps = {
  email: string;
  name: string;
};

export function UserSettingsTabs({ email, name }: UserSettingsTabsProps) {
  const t = useTranslations("settings.tabs");

  return (
    <Tabs className="mt-10" defaultValue="account">
      <TabsList aria-label={t("sections")} variant="line">
        <TabsTrigger
          value="account"
          variant="line"
          data-testid="settings-tab-account"
        >
          {t("account")}
        </TabsTrigger>
        <TabsTrigger
          value="appearance"
          variant="line"
          data-testid="settings-tab-appearance"
        >
          {t("appearance")}
        </TabsTrigger>
      </TabsList>

      <TabsContent className="mt-8" value="account">
        <SettingsPanel description={t("accountDescription")} title={t("account")}>
          <EditNameForm email={email} name={name} />
        </SettingsPanel>
      </TabsContent>

      <TabsContent className="mt-8" value="appearance">
        <SettingsPanel
          description={t("appearanceDescription")}
          title={t("appearance")}
        >
          <ThemeSettings />
        </SettingsPanel>
      </TabsContent>
    </Tabs>
  );
}

type SettingsPanelProps = {
  children: React.ReactNode;
  description: string;
  title: string;
};

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
