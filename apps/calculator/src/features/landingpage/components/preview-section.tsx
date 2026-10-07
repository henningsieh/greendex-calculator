import { getTranslations } from "@greendex/i18n/server";
import Image from "next/image";

/**
 * Preview Section - Hero image below the fold
 * Displays the app interface preview in a bordered card
 */
export async function PreviewSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "landingPage" });

  return (
    <section className="relative px-4 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/30 shadow-xl backdrop-blur-sm">
          <div className="relative aspect-video w-full">
            <Image
              alt="Greendex carbon footprint calculator dashboard showing CO₂ emissions tracking"
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1152px"
              src="/Greendex-hero-banner.png"
            />
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t("hero.imageCaption")}
        </p>
      </div>
    </section>
  );
}
