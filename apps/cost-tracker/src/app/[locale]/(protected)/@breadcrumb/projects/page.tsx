import { getTranslations } from "@greendex/i18n/server";
import { Suspense } from "react";

import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/components/breadcrumb-trail";

async function ProjectsBreadcrumbContent() {
  const t = await getTranslations("shell");
  return <BreadcrumbTrail items={[]} current={t("nav.projects")} />;
}

export default function ProjectsBreadcrumb() {
  return (
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      <ProjectsBreadcrumbContent />
    </Suspense>
  );
}
