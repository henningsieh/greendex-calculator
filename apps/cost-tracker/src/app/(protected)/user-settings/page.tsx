import { getTranslations } from "@greendex/i18n/server";
import type { Metadata } from "next";

import ProtectedPageHeader from "@/components/protected-page-header";
import { UserSettingsTabs } from "@/features/user-settings/components/user-settings-tabs";
import { hasOrganizationMembership, requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "User settings" };

export default async function UserSettingsPage() {
  if (!(await hasOrganizationMembership())) return null;
  const session = await requireSession();
  const t = await getTranslations("settings.page");

  return (
    <div className="max-w-5xl">
      <ProtectedPageHeader title={t("title")} description={t("description")} />

      <UserSettingsTabs email={session.user.email} name={session.user.name} />
    </div>
  );
}
