"use client";

import { useTranslations } from "@greendex/i18n/client";

import {
  SectionTabs,
  SectionTabsList,
  SectionTabsRow,
  SectionTabsTrigger,
  SectionTabsWrapper,
} from "@/components/section-tabs";
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
    <SectionTabsWrapper>
      <SectionTabsRow>
        <SectionTabs defaultValue="hosted">
          <SectionTabsList aria-hidden="true">
            {(["hosted", "partner"] as const).map((scope) => (
              /* Same inline-flex wrapper the resolved tabs get from their
                 TooltipTrigger; it keeps the skeleton trigger the same auto
                 height as the real one. */
              <span className="inline-flex" key={scope}>
                <SectionTabsTrigger value={scope} disabled>
                  <span className="relative">
                    <span className="invisible">{t(scope)}</span>
                    <span className="absolute inset-0 animate-pulse rounded-sm bg-muted" />
                  </span>
                </SectionTabsTrigger>
              </span>
            ))}
          </SectionTabsList>
        </SectionTabs>
        {showMetrics ? <ProjectListMetricsLoading /> : null}
      </SectionTabsRow>
    </SectionTabsWrapper>
  );
}
