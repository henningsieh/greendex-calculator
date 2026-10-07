import { ICON_PATH } from "@greendex/config/metadata";
import { getTranslations } from "@greendex/i18n/server";
import Image from "next/image";

import { DASHBOARD_PATH } from "@/app/routes";
import { PillCTA } from "@/features/landingpage/components/pill-cta";

/**
 * Hero Section - Clean centered layout (OpenClaw.ai style)
 * No hero image here - moved to PreviewSection below the fold
 */
export async function HeroSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "landingPage" });

  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-4 pt-32 pb-16 md:pt-28 md:pb-20">
      <div className="mx-auto max-w-4xl space-y-10 text-center">
        <div className="relative mx-auto mb-4 size-36">
          <Image
            alt="Logo"
            className="animate-pulse"
            fill
            sizes="(max-width: 640px) 120px, 180px"
            src={ICON_PATH}
          />
        </div>
        {/* Gradient Headline */}
        <h1
          className="font-clash text-6xl font-extrabold tracking-tight text-balance sm:text-7xl md:text-8xl lg:text-9xl"
          data-testid="landing-hero-heading"
        >
          <span className="bg-linear-to-r from-emerald-500 via-teal-500 to-sky-500 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-400 dark:to-sky-400">
            GreenDex
          </span>
        </h1>
        <h2 className="text-xl font-bold tracking-tight text-nowrap sm:text-2xl md:text-3xl md:text-balance lg:text-4xl">
          {t("hero.headline")}
        </h2>

        {/* Subtitle */}
        <p
          className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg xl:text-xl"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {t("hero.subtitle")}
        </p>

        {/* Pill CTA */}
        <PillCTA
          href={DASHBOARD_PATH}
          showNewBadge
          className="my-8"
          locale={locale}
        >
          {t("launchButton")}
        </PillCTA>
      </div>
    </section>
  );
}
