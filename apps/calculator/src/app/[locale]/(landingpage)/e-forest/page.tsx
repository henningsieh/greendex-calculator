import { DonateSection } from "@/features/landingpage/components/e+forest/donate-section";
import { DreamSection } from "@/features/landingpage/components/e+forest/dream-section";
import { HeroSection } from "@/features/landingpage/components/e+forest/hero-section";

// ensureStatic = 'navigation': fully static marketing page (#246).
export const ensureStatic = "navigation";

export default function EplusForestPage() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <DreamSection />
      <DonateSection />
    </main>
  );
}
