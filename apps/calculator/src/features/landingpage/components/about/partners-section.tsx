import { PARTNERS } from "@greendex/config/partners";
import { getTranslations } from "@greendex/i18n/server";

import { PartnerCard } from "@/features/landingpage/components/about/partner-card";

/**
 * Partners content section with title, intro, and partner cards grid
 */
export async function PartnersSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "landingPage.about" });

  return (
    <section className="py-12">
      <div className="container mx-auto max-w-7xl px-4 text-center">
        <h2 className="mb-8 text-3xl font-bold md:text-4xl lg:text-5xl">
          {t("partnersTitle")}
        </h2>
        <p className="mx-auto mb-12 max-w-5xl text-lg text-muted-foreground lg:text-xl">
          {t("partnersHeadline")}
        </p>
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
            {PARTNERS.map((p) => (
              <PartnerCard key={p.id} partner={p} locale={locale} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
