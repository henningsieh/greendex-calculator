import { getTranslations } from "@greendex/i18n/server";
import { ArrowRightIcon } from "lucide-react";

import { Aura } from "@/components/brand/aura";
import { LandingCtaButton } from "@/components/brand/landing-cta-button";
import { LanguageSelector } from "@/components/language-selector";
import { SiteBrand } from "@/components/site-brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClaimCalculation } from "@/features/claims/components/claim-calculation";
import type { ClaimCostRecord } from "@/features/claims/components/claim-cost-records";
import { ClaimCostRecords } from "@/features/claims/components/claim-cost-records";
import { ClaimBandHeader } from "@/features/claims/components/claim-document";
import type { ClaimReadinessItem } from "@/features/claims/components/claim-readiness";
import { ClaimReadiness } from "@/features/claims/components/claim-readiness";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/* One sample Claim carries every figure on this page, so the arithmetic the
   visitor reads is the arithmetic the workspace would store. Development data:
   no live Claim exists. */
const sample = {
  participants: 2,
  trainEur: "428.60",
  busEur: "86.40",
  totalEur: "515.00",
} as const;

export default async function LandingPage() {
  const t = await getTranslations("shell");

  const sampleCosts: ClaimCostRecord[] = [
    {
      id: "train",
      transportProfile: "train",
      detail: t("landing.sample.train"),
      participants: sample.participants,
      amountEur: sample.trainEur,
      receipts: 1,
      allocation: "equal",
    },
    {
      id: "bus",
      transportProfile: "bus",
      detail: t("landing.sample.bus"),
      participants: sample.participants,
      amountEur: sample.busEur,
      receipts: 1,
      allocation: "equal",
    },
  ];

  const readiness: ClaimReadinessItem[] = [
    {
      key: "payoutAccount",
      passed: true,
      detail: t("landing.sample.checkPayout"),
    },
    { key: "entries", passed: true, detail: t("landing.sample.checkEntries") },
    {
      key: "proofDocuments",
      passed: true,
      detail: t("landing.sample.checkProofs"),
    },
    { key: "journeys", passed: true, detail: t("landing.sample.checkJourneys") },
  ];

  return (
    <main className="min-h-svh overflow-hidden">
      {/* The marketing header carries its own composition: the brand and one
          entry action at every width, the preference controls from sm up. */}
      <header className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="flex min-h-18 flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
          <SiteBrand />
          <nav
            aria-label={t("landing.accountNav")}
            className="ml-auto flex items-center gap-1.5 sm:gap-2"
          >
            <div className="hidden sm:flex">
              <ThemeSwitcher />
            </div>
            <LanguageSelector />
            <Link
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "px-3 sm:px-4",
              )}
              href="/login"
            >
              {t("common.signIn")}
            </Link>
            <Link
              className={cn(
                buttonVariants({ size: "sm" }),
                "hidden sm:inline-flex",
              )}
              href="/register"
            >
              {t("landing.createAccount")}
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative mx-auto grid w-full max-w-7xl items-start gap-x-12 gap-y-10 px-5 pt-8 pb-20 sm:px-8 sm:pt-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:px-10 lg:pt-12 lg:pb-28">
        <Aura className="absolute -top-32 left-1/2 h-72 w-180 -translate-x-1/2" />
        <div className="relative lg:col-span-2">
          {/* Each phrase keeps its own line so a longer locale wraps inside the
              phrase instead of stranding a word alone. Hyphenation is the last
              resort for words a display size cannot fit (fr, es, nl). */}
          <h1 className="type-ember-display hyphens-auto max-lg:text-[clamp(2.5rem,11vw,3.5rem)]">
            <span className="block">{t("landing.hero.titleLead")}</span>
            <span className="ember-headline-accent block text-primary">
              {t("landing.hero.titleAccent")}
            </span>
          </h1>
        </div>

        <div className="relative max-w-xl">
          <p className="text-lg/8 text-muted-foreground sm:text-xl">
            {t("landing.hero.description")}
          </p>
          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <LandingCtaButton href="/register">
              {t("landing.hero.start")}
              <ArrowRightIcon data-icon="inline-end" />
            </LandingCtaButton>
            <Link
              className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}
              href="#how-it-works"
            >
              {t("landing.hero.seeHow")}
            </Link>
          </div>
          <p className="mt-5 max-w-[20rem] font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase sm:max-w-none">
            {t("landing.hero.trustLine")}
          </p>
        </div>

        {/* The Claim document the rest of the page reads from: the same card
            anatomy the protected workspace will use, with sample figures. */}
        {/* eslint-disable-next-line shadcn/no-restyle -- A Claim document is one card whose band header must bleed to its edges; Card's own rhythm would inset the band into a nested-card look. */}
        <Card className="mx-auto w-full max-w-lg gap-0 py-0 lg:mr-0">
          <ClaimBandHeader
            status="in_preparation"
            subtitle={t("landing.sample.partner")}
            title={t("landing.sample.project")}
          />
          <ClaimCostRecords
            rows={sampleCosts}
            total={{
              amountEur: sample.totalEur,
              participants: sample.participants,
            }}
          />
        </Card>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
        <ClaimCalculation
          addends={[
            {
              id: "train",
              transportProfile: "train",
              detail: t("landing.sample.train"),
              amountEur: sample.trainEur,
            },
            {
              id: "bus",
              transportProfile: "bus",
              detail: t("landing.sample.bus"),
              amountEur: sample.busEur,
            },
          ]}
          total={{
            detail: t("landing.sample.total"),
            amountEur: sample.totalEur,
          }}
        />
        <p className="mt-3 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          {t("landing.sample.caption")}
        </p>
      </section>

      <section
        className="mx-auto grid w-full max-w-7xl items-start gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:px-10 lg:py-28"
        id="how-it-works"
      >
        <div>
          <h2 className="max-w-md text-3xl sm:text-4xl">
            {t("landing.process.title")}
          </h2>
          <p className="mt-5 max-w-prose leading-7 text-muted-foreground">
            {t("landing.process.description")}
          </p>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border bg-border">
            <ProcessStep
              description={t("landing.process.record.description")}
              number="1"
              title={t("landing.process.record.title")}
            />
            <ProcessStep
              description={t("landing.process.support.description")}
              number="2"
              title={t("landing.process.support.title")}
            />
            <ProcessStep
              description={t("landing.process.allocate.description")}
              number="3"
              title={t("landing.process.allocate.title")}
            />
          </ol>
        </div>
        <ClaimReadiness items={readiness} />
      </section>

      <section className="border-y bg-card/60">
        <div className="mx-auto grid w-full max-w-7xl divide-y px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-10">
          <ValuePoint
            description={t("landing.values.proof.description")}
            title={t("landing.values.proof.title")}
          />
          <ValuePoint
            description={t("landing.values.group.description")}
            title={t("landing.values.group.title")}
          />
          <ValuePoint
            description={t("landing.values.partners.description")}
            title={t("landing.values.partners.title")}
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-20 text-center sm:px-8 lg:px-10 lg:py-28">
        <h2 className="mx-auto max-w-2xl text-3xl text-balance sm:text-5xl">
          {t("landing.cta.title")}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
          {t("landing.cta.description")}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <LandingCtaButton href="/register">
            {t("landing.hero.start")}
            <ArrowRightIcon data-icon="inline-end" />
          </LandingCtaButton>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <SiteBrand />
          <p className="text-sm text-muted-foreground">
            {t("landing.footer.tagline")}
          </p>
        </div>
      </footer>
    </main>
  );
}

interface ValuePointProps {
  description: string;
  title: string;
}

function ValuePoint({ description, title }: ValuePointProps) {
  return (
    <article className="py-8 md:px-8 md:py-10 md:first:pl-0 md:last:pr-0">
      <h2 className="text-lg">{title}</h2>
      <p className="mt-3 max-w-sm leading-7 text-muted-foreground">
        {description}
      </p>
    </article>
  );
}

interface ProcessStepProps {
  description: string;
  number: string;
  title: string;
}

function ProcessStep({ description, number, title }: ProcessStepProps) {
  return (
    <li className="flex gap-4 bg-card p-5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-xs font-semibold text-secondary-foreground">
        {number}
      </span>
      <div className="min-w-0">
        <h3 className="text-lg">{title}</h3>
        <p className="mt-1 text-sm/6 text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}
