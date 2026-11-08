import { getTranslations } from "@greendex/i18n/server";

import ProtectedPageHeader from "@/components/protected-page-header";

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
