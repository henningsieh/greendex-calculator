import { getTranslations } from "@greendex/i18n/server";

import { RouteTransition } from "@/components/view-transition-boundaries";
import { ProtectedRouteHeader } from "@/features/breadcrumbs/components/protected-route-header";
import { UserSettingsTabs } from "@/features/user-settings/components/user-settings-tabs";
import { requireSession } from "@/lib/session";

export default async function UserSettingsPage() {
  const session = await requireSession();
  const t = await getTranslations("settings.page");

  return (
    <RouteTransition>
      <div className="max-w-5xl">
        <ProtectedRouteHeader
          page="account"
          title={t("title")}
          description={t("description")}
        />

        <UserSettingsTabs email={session.user.email} name={session.user.name} />
      </div>
    </RouteTransition>
  );
}
