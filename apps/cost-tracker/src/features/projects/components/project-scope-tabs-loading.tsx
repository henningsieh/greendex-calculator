"use client";

import { useTranslations } from "@greendex/i18n/client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectListMetricsLoading } from "@/features/projects/components/project-list-metrics-loading";

/**
 * Scope tabs plus metrics.
 *
 * Tab widths are driven by translated copy ("Hosted Projects", "Gehostete
 * Projekte", ...), which is static — it does not depend on the query. So the
 * skeleton does not guess a bar width: each trigger keeps its real label,
 * rendered invisible, and a skeleton bar is painted over it. The tab row is
 * therefore exactly as wide as the resolved tabs in every locale, and the
 * metrics that sit beside it never shift.
 */
export function ProjectScopeTabsLoading({
  showMetrics = true,
}: {
  showMetrics?: boolean;
}) {
  const t = useTranslations("projects.list");
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <Tabs defaultValue="hosted">
        <TabsList variant="line" aria-hidden="true">
          {(["hosted", "partner"] as const).map((scope) => (
            /* Same inline-flex wrapper the resolved tabs get from their
               TooltipTrigger; it gives the trigger an auto height, so the
               padding box overflows the 40px list exactly like the real one. */
            <span className="inline-flex" key={scope}>
              <TabsTrigger variant="line-base" value={scope} disabled>
                <span className="relative">
                  <span className="invisible">{t(scope)}</span>
                  <span className="absolute inset-0 animate-pulse rounded-sm bg-muted" />
                </span>
              </TabsTrigger>
            </span>
          ))}
        </TabsList>
      </Tabs>
      {showMetrics ? <ProjectListMetricsLoading /> : null}
    </div>
  );
}
