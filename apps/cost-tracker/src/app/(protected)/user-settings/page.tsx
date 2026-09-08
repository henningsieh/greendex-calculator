import type { Metadata } from "next";

import { UserSettingsTabs } from "@/features/user-settings/components/user-settings-tabs";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "User settings" };

export default async function UserSettingsPage() {
  const session = await requireSession();

  return (
    <div className="max-w-5xl">
      <header className="max-w-2xl">
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          User settings
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Choose how Cost Tracker looks and keep your account details current.
        </p>
      </header>

      <UserSettingsTabs email={session.user.email} name={session.user.name} />
    </div>
  );
}
