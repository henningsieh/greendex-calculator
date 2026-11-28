import { getTranslations } from "@greendex/i18n/server";

import { RouteTransition } from "@/components/view-transition-boundaries";
import { ProtectedRouteHeader } from "@/features/breadcrumbs/components/protected-route-header";

export default async function PartnershipDetailPage() {
  const t = await getTranslations("partnerships.detail");

  return (
    <RouteTransition>
      <div className="space-y-8">
        <ProtectedRouteHeader
          page="partnership"
          title={t("title")}
          description={t("description")}
        />
      </div>
    </RouteTransition>
  );
}
