import { Suspense } from "react";

import { AboutFooter } from "@/features/landingpage/components/about/about-footer";
import { AboutHeader } from "@/features/landingpage/components/about/about-header";
import { PartnersSection } from "@/features/landingpage/components/about/partners-section";

// ensureStatic = 'navigation': fully static marketing page (#246).
export const ensureStatic = "navigation";

/**
 * Renders the About page with a layout-shaped placeholder that paints
 * first while the localized sections stream in.
 *
 * @returns The About page JSX element
 */
export default function AboutPage({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  return (
    <main className="min-h-screen">
      <Suspense fallback={<AboutHeaderSkeleton />}>
        <LocalizedAboutHeader params={params} />
      </Suspense>
      <Suspense fallback={<PartnersSkeleton />}>
        <LocalizedPartners params={params} />
      </Suspense>
      <Suspense fallback={<AboutFooterSkeleton />}>
        <LocalizedAboutFooter params={params} />
      </Suspense>
    </main>
  );
}

async function LocalizedAboutHeader({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return <AboutHeader locale={locale} />;
}

async function LocalizedPartners({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return <PartnersSection locale={locale} />;
}

async function LocalizedAboutFooter({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return <AboutFooter locale={locale} />;
}

function AboutHeaderSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6 px-6 pt-28 pb-12 text-center">
      <div className="mx-auto h-8 w-48 animate-pulse rounded-full bg-muted/60" />
      <div className="mx-auto h-14 w-2/3 animate-pulse rounded-2xl bg-muted/60" />
      <div className="mx-auto h-6 w-1/2 animate-pulse rounded-xl bg-muted/40" />
    </div>
  );
}

function PartnersSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="mx-auto h-10 w-1/3 animate-pulse rounded-2xl bg-muted/60" />
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl bg-muted/40" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted/40" />
      </div>
    </div>
  );
}

function AboutFooterSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto max-w-5xl px-6 py-12 text-center">
      <div className="mx-auto h-6 w-2/3 animate-pulse rounded-xl bg-muted/40" />
      <div className="mx-auto mt-4 h-4 w-1/3 animate-pulse rounded bg-muted/40" />
    </div>
  );
}
