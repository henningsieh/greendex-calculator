import { getTranslations } from "@greendex/i18n/server";

import { PrefetchedPageSkeleton } from "@/components/prefetched-page-skeleton";

export default async function Loading() {
  const t = await getTranslations("organizations.loading");
  return <PrefetchedPageSkeleton label={t("label")} />;
}
