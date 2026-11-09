import { getTranslations } from "@greendex/i18n/server";

import ProtectedPageHeader from "@/components/protected-page-header";

/**
 * Deliberately header-only. The Partnership crumb links here, so the route has
 * to exist; Partnership work lives on the Participants and Claim pages, and a
 * summary view is not planned for this release.
 */
export default async function PartnershipDetailPage() {
  const t = await getTranslations("partnerships.detail");

  return (
    <div className="space-y-8">
      <ProtectedPageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
    </div>
  );
}
