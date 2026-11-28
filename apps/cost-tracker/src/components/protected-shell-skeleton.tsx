"use client";

import { useTranslations } from "@greendex/i18n/client";

import {
  AppHeaderRow,
  protectedFrameClassName,
  protectedMainClassName,
} from "@/components/app-header-row";
import {
  ProtectedPageHeaderLoading,
  LoadingRegion,
} from "@/components/loading-skeletons";
import { buttonVariants } from "@/components/ui/button";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ProtectedPageSkeleton() {
  const t = useTranslations("shell");

  return (
    <LoadingRegion label={t("loading")}>
      <ProtectedPageHeaderLoading />
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
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" render={<div />}>
          <Skeleton className="size-8 shrink-0" />
          <div className="grid flex-1 gap-1.5 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-3.5 w-28" />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
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
 * column, the content column and the app bar — rather than
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
        <SidebarHeader>
          <SidebarBrandRowSkeleton />
        </SidebarHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
          <SidebarGroupSkeleton rows={["w-24", "w-16"]} />
          <SidebarGroupSkeleton rows={["w-20"]} />
          <SidebarGroupSkeleton rows={["w-24", "w-16"]} />
        </div>
        <SidebarFooter>
          <SidebarBrandRowSkeleton />
        </SidebarFooter>
      </Sidebar>
      <div
        className={protectedFrameClassName}
        data-testid="protected-shell-skeleton-content"
      >
        <LoadingRegion label={t("loading")}>
          <header className="border-b bg-background">
            <AppHeaderRow
              leading={
                <div
                  className={cn(
                    buttonVariants({
                      variant: "ghost",
                      size: "icon-SidebarTrigger",
                    }),
                    "pointer-events-none overflow-hidden",
                  )}
                >
                  <Skeleton className="size-full" />
                </div>
              }
            >
              <div className="flex items-center gap-2">
                <Skeleton className="size-9" />
                <Skeleton className="size-9" />
                <Skeleton className="size-9 lg:w-28" />
              </div>
            </AppHeaderRow>
          </header>
          <main className={protectedMainClassName}>
            <ProtectedPageHeaderLoading />
          </main>
        </LoadingRegion>
      </div>
    </SidebarProvider>
  );
}
