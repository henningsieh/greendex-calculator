"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditNameForm } from "@/features/user-settings/components/edit-name-form";
import { ThemeSettings } from "@/features/user-settings/components/theme-settings";

type UserSettingsTabsProps = {
  email: string;
  name: string;
};

export function UserSettingsTabs({ email, name }: UserSettingsTabsProps) {
  return (
    <Tabs className="mt-10 gap-0" defaultValue="appearance">
      <TabsList
        aria-label="User settings sections"
        className="grid h-auto w-full grid-cols-2 justify-start gap-0 border-b p-0 sm:flex sm:gap-8"
        variant="line"
      >
        <TabsTrigger
          className="py-4 text-sm tracking-normal normal-case sm:flex-none sm:px-0"
          value="appearance"
        >
          Appearance
        </TabsTrigger>
        <TabsTrigger
          className="py-4 text-sm tracking-normal normal-case sm:flex-none sm:px-0"
          value="account"
        >
          Account details
        </TabsTrigger>
      </TabsList>

      <TabsContent className="pt-10" value="appearance">
        <SettingsPanel
          description="Your choice is saved in this browser."
          title="Appearance"
        >
          <ThemeSettings />
        </SettingsPanel>
      </TabsContent>

      <TabsContent className="pt-10" value="account">
        <SettingsPanel
          description="Keep the identity shown to other Project members accurate."
          title="Account details"
        >
          <EditNameForm email={email} name={name} />
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
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}
