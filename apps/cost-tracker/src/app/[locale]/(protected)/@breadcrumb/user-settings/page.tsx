import { getTranslations } from "@greendex/i18n/server";
import { Suspense } from "react";

import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/components/breadcrumb-trail";

async function UserSettingsBreadcrumbContent() {
  const t = await getTranslations("shell");
  return <BreadcrumbTrail items={[]} current={t("crumbs.userSettings")} />;
}

// Request-time chrome: the breadcrumb resolves at request time.
export const instant = false;

export default function UserSettingsBreadcrumb() {
  return (
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      <UserSettingsBreadcrumbContent />
    </Suspense>
  );
}
