import { Suspense } from "react";

import { FooterSection } from "@/features/landingpage/components/footer";
import { LandingHeader } from "@/features/landingpage/components/landing-header";
import { LandingPageBackground } from "@/features/landingpage/components/landing-page-background";
import { LandingPageGradients } from "@/features/landingpage/components/landing-page-gradients";

// ensureStatic = 'prefetch': the marketing shell and per-link prefetches stay
// static; only request-specific islands (workshops tab state, auth forms)
// stream at navigation (#246).
export const ensureStatic = "prefetch";

/**
 * Layout wrapper that renders the landing page chrome and hosts page content.
 *
 * Renders background, the landing header, the provided `children`, and the footer in a stacked layout.
 *
 * @param children - React nodes to be displayed as the main content of the landing page
 * @param params - Route params carrying the `[locale]` segment, forwarded to the footer translations.
 * @returns The composed landing page JSX element
 */
export default function LandingPageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}) {
  return (
    <div className="relative min-h-screen">
      <LandingPageGradients />
      <LandingPageBackground />
      <div className="relative z-10">
        <LandingHeader />
        {children}
        <Suspense fallback={<FooterSkeleton />}>
          <LocalizedFooter params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function LocalizedFooter({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return <FooterSection locale={locale} />;
}

function FooterSkeleton() {
  return (
    <footer
      aria-hidden="true"
      className="border-t bg-background/50 pt-16 pb-10 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-5">
          <div className="space-y-6 md:col-span-2">
            <div className="h-8 w-32 animate-pulse rounded bg-muted/60" />
            <div className="h-12 w-56 animate-pulse rounded-full bg-muted/60" />
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-3">
            <div className="space-y-3">
              <div className="h-4 w-20 animate-pulse rounded bg-muted/60" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="space-y-3">
              <div className="h-4 w-20 animate-pulse rounded bg-muted/60" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="space-y-3">
              <div className="h-4 w-20 animate-pulse rounded bg-muted/60" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
