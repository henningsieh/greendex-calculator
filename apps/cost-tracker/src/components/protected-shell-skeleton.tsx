"use client";

import { useTranslations } from "@greendex/i18n/client";

import { HeaderSkeleton, LoadingRegion } from "@/components/loading-skeletons";
import { SiteBrand } from "@/components/site-brand";
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbTrailFallback } from "@/features/breadcrumbs/components/breadcrumb-trail";
import { cn } from "@/lib/utils";

export function ProtectedPageSkeleton() {
  const t = useTranslations("shell");

  return (
    <LoadingRegion label={t("loading")}>
      <HeaderSkeleton />
    </LoadingRegion>
  );
}

/**
 * One sidebar row, shaped like `SidebarMenuButton`: h-9 with a size-4 icon
 * and a label. Mirrors the primitive's icon-collapsed geometry, so the rail
 * keeps its proportions when the persisted state is collapsed.
 */
function SidebarMenuRowSkeleton({ label }: { label: string }) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-lg px-3 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2">
      <Skeleton className="size-4 shrink-0" />
      <Skeleton
        className={cn("h-3.5 group-data-[collapsible=icon]:hidden", label)}
      />
    </div>
  );
}

function SidebarBrandRowSkeleton() {
  return (
    <div className="flex h-14 items-center gap-2 px-3">
      <Skeleton className="size-8 shrink-0" />
      <div className="grid flex-1 gap-1.5 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-3.5 w-28" />
      </div>
    </div>
  );
}

function SidebarGroupSkeleton({ rows }: { rows: string[] }) {
  return (
    <div className="flex w-full min-w-0 flex-col p-2">
      <div className="flex h-8 shrink-0 items-center px-3 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex w-full min-w-0 flex-col gap-0.5">
        {rows.map((label) => (
          <SidebarMenuRowSkeleton key={label} label={label} />
        ))}
      </div>
    </div>
  );
}

/**
 * First-paint shell. It reproduces the real shell's frame — the sidebar
 * column, the content column, the app bar and the breadcrumb row — rather than
 * approximating it, so nothing moves sideways when `ProtectedShell` streams
 * in. `sidebarOpen` comes from the persisted preference, read by the layout
 * above the Suspense boundary; the widths themselves come from the same
 * `Sidebar` primitive the real shell uses.
 */
export function ProtectedShellSkeleton({
  sidebarOpen,
}: {
  sidebarOpen: boolean;
}) {
  const t = useTranslations("shell");

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <Sidebar collapsible="icon" side="left">
        <div className="flex flex-col gap-2 p-2">
          <SidebarBrandRowSkeleton />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
          <SidebarGroupSkeleton rows={["w-24", "w-16", "w-20"]} />
          <SidebarGroupSkeleton rows={["w-28"]} />
        </div>
        <div className="flex flex-col gap-2 p-2">
          <SidebarBrandRowSkeleton />
        </div>
      </Sidebar>
      <div
        className="min-h-svh w-full min-w-0 bg-muted/35"
        data-testid="protected-shell-skeleton-content"
      >
        <LoadingRegion label={t("loading")}>
          <header className="border-b bg-background">
            <div className="flex items-start gap-1">
              <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
                <div className="flex h-18 items-center justify-between">
                  <SiteBrand />
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-9" />
                    <Skeleton className="size-9" />
                    <Skeleton className="h-9 w-28" />
                  </div>
                </div>
              </div>
            </div>
            <BreadcrumbTrailFallback />
          </header>
          <main className="@container/content mx-auto w-full max-w-7xl px-5 py-6 sm:px-8.5 lg:px-10 lg:py-8">
            <HeaderSkeleton />
          </main>
        </LoadingRegion>
      </div>
    </SidebarProvider>
  );
}
