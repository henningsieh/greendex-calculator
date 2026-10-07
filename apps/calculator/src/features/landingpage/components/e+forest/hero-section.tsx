"use client";

import { eForestConfig } from "@greendex/config/e-forest";
import { useTranslations } from "@greendex/i18n/client";
import Image from "next/image";

export function HeroSection() {
  const t = useTranslations("landingPage.EPlusForest.hero");

  return (
    <div className="relative h-[50vh] min-h-125 w-full overflow-hidden">
      <Image
        alt={t("title")}
        className="object-cover"
        fill
        priority
        src={eForestConfig.heroImage}
        style={{ objectPosition: "bottom" }}
      />
      <div className="absolute inset-0 bg-background/60" />
      <div className="relative z-10 container mx-auto flex h-full items-center justify-center">
        <h1
          className="text-center text-5xl font-bold text-foreground lg:text-7xl"
          data-testid="landing-hero-heading"
        >
          {t("title")}
        </h1>
      </div>
    </div>
  );
}
