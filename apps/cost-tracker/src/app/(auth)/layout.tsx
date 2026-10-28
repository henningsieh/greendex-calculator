import { getTranslations } from "@greendex/i18n/server";
import { CheckIcon } from "lucide-react";

import { SiteBrand } from "@/components/site-brand";

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const t = await getTranslations("onboarding.layout");

  return (
    <main className="grid min-h-svh lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute top-1/3 -right-28 size-80 rounded-full border border-primary-foreground/10" />
        <div className="absolute top-1/3 -right-10 size-44 rounded-full border border-primary-foreground/15" />
        <SiteBrand className="text-primary-foreground" />

        <div className="relative max-w-lg">
          <p className="font-heading text-4xl font-semibold tracking-tight text-balance xl:text-5xl">
            {t("tagline")}
          </p>
          <ul className="mt-9 flex flex-col gap-4 text-sm text-primary-foreground/80">
            <AuthBenefit>{t("benefitTotals")}</AuthBenefit>
            <AuthBenefit>{t("benefitDocuments")}</AuthBenefit>
            <AuthBenefit>{t("benefitAllocations")}</AuthBenefit>
          </ul>
        </div>

        <p className="text-sm text-primary-foreground/65">{t("footer")}</p>
      </section>

      <section className="flex min-h-svh flex-col bg-background p-5 sm:px-8 lg:px-14 xl:px-20">
        <SiteBrand className="lg:hidden" />
        <div className="flex flex-1 items-center justify-center py-12 has-data-onboarding-state:items-start has-data-onboarding-state:py-4">
          {children}
        </div>
      </section>
    </main>
  );
}

function AuthBenefit({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-6 items-center justify-center rounded-full bg-primary-foreground/10">
        <CheckIcon aria-hidden="true" className="size-3.5" />
      </span>
      {children}
    </li>
  );
}
