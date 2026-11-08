import { getTranslations } from "@greendex/i18n/server";
import { Suspense } from "react";

import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/components/breadcrumb-trail";

async function ProjectsBreadcrumbContent() {
  const t = await getTranslations("shell");
  return <BreadcrumbTrail items={[]} current={t("nav.projects")} />;
}

// Request-time chrome: the breadcrumb resolves at request time.
export const instant = false;

export default function ProjectsBreadcrumb() {
  return (
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      <ProjectsBreadcrumbContent />
    </Suspense>
  );
}
