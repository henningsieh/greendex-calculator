import { getTranslations } from "@greendex/i18n/server";

import ProtectedPageHeader from "@/components/protected-page-header";
import { UserSettingsTabs } from "@/features/user-settings/components/user-settings-tabs";
import { requireSession } from "@/lib/session";

export default async function UserSettingsPage() {
  const session = await requireSession();
  const t = await getTranslations("settings.page");

  return (
    <div className="max-w-5xl">
      <ProtectedPageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />

      <UserSettingsTabs email={session.user.email} name={session.user.name} />
    </div>
  );
}
