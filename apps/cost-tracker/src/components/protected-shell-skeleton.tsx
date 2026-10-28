"use client";

import { useTranslations } from "@greendex/i18n/client";

import { SiteBrand } from "@/components/site-brand";
import { Skeleton } from "@/components/ui/skeleton";

export function ProtectedShellSkeleton() {
  const t = useTranslations("shell");

  return (
    <div className="min-h-svh bg-muted/35">
      <output className="sr-only" aria-label={t("loading")}>
        {t("loading")}
      </output>
      <header className="border-b bg-background">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex h-18 items-center justify-between">
            <SiteBrand />
            <Skeleton className="size-9" />
          </div>
          <div aria-hidden="true" className="flex h-14 items-center gap-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-36" />
          </div>
        </div>
      </header>
      <main
        className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-10 sm:px-8 lg:px-10 lg:py-14"
        aria-hidden="true"
      >
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-80 max-w-full" />
        <Skeleton className="h-64 w-full" />
      </main>
    </div>
  );
}
