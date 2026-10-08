// apps/documentation/src/app/[lang]/docs/layout.tsx
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Suspense } from "react";

import { LanguageToggleInline } from "@/components/language-toggle";
import { baseOptions } from "@/components/layout.shared";
import { source } from "@/lib/source";

export default function Layout({
  params,
  children,
}: LayoutProps<"/[lang]/docs">) {
  return (
    <Suspense fallback={<DocsChromeSkeleton />}>
      <LocalizedDocsLayout params={params}>{children}</LocalizedDocsLayout>
    </Suspense>
  );
}

async function LocalizedDocsLayout({
  params,
  children,
}: Pick<LayoutProps<"/[lang]/docs">, "params"> & {
  children: React.ReactNode;
}) {
  const { lang } = await params;
  const options = baseOptions();

  return (
    <DocsLayout
      {...options}
      tree={source.getPageTree(lang)}
      nav={{
        ...options.nav, // ✅ Keeps existing nav config (title, links, etc.)
        children: <LanguageToggleInline />,
      }}
    >
      {children}
    </DocsLayout>
  );
}

function DocsChromeSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex w-full max-w-6xl gap-8 px-6 py-10"
    >
      <div className="hidden w-64 shrink-0 space-y-3 md:block">
        <div className="h-6 w-3/4 animate-pulse rounded bg-muted/60" />
        <div className="h-6 w-full animate-pulse rounded bg-muted/40" />
        <div className="h-6 w-5/6 animate-pulse rounded bg-muted/40" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-muted/40" />
      </div>
      <div className="flex-1 space-y-4">
        <div className="h-10 w-1/2 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted/40" />
      </div>
    </div>
  );
}
