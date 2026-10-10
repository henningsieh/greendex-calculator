import { Suspense } from "react";

import { DonateSection } from "@/features/landingpage/components/e+forest/donate-section";
import { DreamSection } from "@/features/landingpage/components/e+forest/dream-section";
import { HeroSection } from "@/features/landingpage/components/e+forest/hero-section";

// ensureStatic = 'navigation': fully static marketing page (#246).
export const ensureStatic = "navigation";

/**
 * Render the E+ Forest introduction, forest initiatives, and donation
 * information using the route locale.
 */
export default function EplusForestPage({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  return (
    <main className="min-h-screen">
      <Suspense fallback={<EForestHeroSkeleton />}>
        <LocalizedEForestHero params={params} />
      </Suspense>
      <Suspense fallback={<EForestDreamSkeleton />}>
        <LocalizedDream params={params} />
      </Suspense>
      <Suspense fallback={<EForestDonateSkeleton />}>
        <LocalizedDonate params={params} />
      </Suspense>
    </main>
  );
}

async function LocalizedEForestHero({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return <HeroSection locale={locale} />;
}

async function LocalizedDream({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return <DreamSection locale={locale} />;
}

async function LocalizedDonate({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return <DonateSection locale={locale} />;
}

function EForestHeroSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-[50vh] min-h-125 items-center justify-center"
    >
      <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-muted/60" />
    </div>
  );
}

function EForestDreamSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto max-w-5xl space-y-6 px-6 py-16 text-center"
    >
      <div className="mx-auto h-12 w-1/2 animate-pulse rounded-2xl bg-muted/60" />
      <div className="mx-auto h-6 w-2/3 animate-pulse rounded-xl bg-muted/40" />
    </div>
  );
}

function EForestDonateSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto max-w-5xl px-6 py-16 text-center">
      <div className="mx-auto h-12 w-56 animate-pulse rounded-full bg-muted/60" />
      <div className="mx-auto mt-4 h-4 w-1/3 animate-pulse rounded-sm bg-muted/40" />
    </div>
  );
}
