"use client";

import { useTranslations } from "@greendex/i18n/client";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
export function TabsMetricsSkeleton() {
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
              <TabsTrigger variant="line" value={scope} disabled>
                <span className="relative">
                  <span className="invisible">{t(scope)}</span>
                  <span className="absolute inset-0 animate-pulse rounded-sm bg-muted" />
                </span>
              </TabsTrigger>
            </span>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <Skeleton className="h-5 w-32" data-testid="loading-skeleton" />
        <Skeleton className="h-5 w-36" data-testid="loading-skeleton" />
      </div>
    </div>
  );
}
