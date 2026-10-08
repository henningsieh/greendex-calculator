import { DonateSection } from "@/features/landingpage/components/e+forest/donate-section";
import { DreamSection } from "@/features/landingpage/components/e+forest/dream-section";
import { HeroSection } from "@/features/landingpage/components/e+forest/hero-section";

// ensureStatic = 'navigation': fully static marketing page (#246).
export const ensureStatic = "navigation";

export default async function EplusForestPage({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  // The `[locale]` param is forwarded to the translated sections so no
  // request-header lookup runs during prerendering (#246).
  const { locale } = await params;
  return (
    <main className="min-h-screen">
      <HeroSection locale={locale} />
      <DreamSection locale={locale} />
      <DonateSection locale={locale} />
    </main>
  );
}
