import { Suspense } from "react";

import { GlobeSection } from "@/features/landingpage/components/globe-section";
import { HeroSection } from "@/features/landingpage/components/hero-section";
import { PreviewSection } from "@/features/landingpage/components/preview-section";
import { WorkshopsHeroSection } from "@/features/landingpage/components/workshops/workshops-hero-section";

// ensureStatic = 'navigation': fully static marketing page; the build fails
// if request-time rendering creeps in (#246).
export const ensureStatic = "navigation";

/**
 * Render the landing page with the following structure:
 * 1. HeroSection - Clean centered headline with CTA (no image)
 * 2. GlobeSection - Interactive globe
 * 3. WorkshopsHeroSection - Workshop cards
 * 4. PreviewSection - App interface preview
 *
 * Fully static: the `[locale]` param is forwarded to the translated
 * sections so no request-header lookup runs during prerendering (#246).
 *
 * @returns The JSX element for the landing page.
 */
export default function LandingPage({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  return (
    <main className="relative overflow-hidden">
      <Suspense fallback={<HeroSkeleton />}>
        <LocalizedHero params={params} />
      </Suspense>

      <GlobeSection />

      <Suspense fallback={<WorkshopsSkeleton />}>
        <LocalizedWorkshops params={params} />
      </Suspense>

      <Suspense fallback={<PreviewSkeleton />}>
        <LocalizedPreview params={params} />
      </Suspense>
    </main>
  );
}

async function LocalizedHero({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return <HeroSection locale={locale} />;
}

async function LocalizedWorkshops({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return <WorkshopsHeroSection locale={locale} />;
}

async function LocalizedPreview({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return <PreviewSection locale={locale} />;
}

function HeroSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="relative flex min-h-[90vh] flex-col items-center justify-center px-4 pt-32 pb-16 md:pt-28 md:pb-20"
    >
      <div className="mx-auto max-w-4xl space-y-10 text-center">
        <div className="mx-auto mb-4 size-36 animate-pulse rounded-full bg-muted/60" />
        <div className="mx-auto h-20 w-3/4 animate-pulse rounded-2xl bg-muted/60 sm:h-24 md:h-28" />
        <div className="mx-auto h-8 w-2/3 animate-pulse rounded-xl bg-muted/40" />
        <div className="mx-auto h-6 w-1/2 animate-pulse rounded-xl bg-muted/40" />
        <div className="mx-auto h-12 w-56 animate-pulse rounded-full bg-muted/60" />
      </div>
    </section>
  );
}

function WorkshopsSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="relative overflow-hidden border-y border-border/30 py-24 md:py-32 lg:py-40"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-20 space-y-8 text-center">
          <div className="mx-auto h-8 w-48 animate-pulse rounded-full bg-muted/60" />
          <div className="mx-auto h-14 w-3/4 animate-pulse rounded-2xl bg-muted/60" />
          <div className="mx-auto h-6 w-2/3 animate-pulse rounded-xl bg-muted/40" />
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="h-96 animate-pulse rounded-2xl bg-muted/40" />
          <div className="h-96 animate-pulse rounded-2xl bg-muted/40" />
          <div className="h-96 animate-pulse rounded-2xl bg-muted/40" />
        </div>
      </div>
    </section>
  );
}

function PreviewSkeleton() {
  return (
    <section aria-hidden="true" className="relative px-4 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="aspect-video w-full animate-pulse rounded-2xl bg-muted/40" />
        <div className="mx-auto mt-4 h-4 w-64 animate-pulse rounded bg-muted/40" />
      </div>
    </section>
  );
}
