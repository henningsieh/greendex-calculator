import { getTranslations } from "@greendex/i18n/server";
import {
  ArrowRightIcon,
  CheckIcon,
  FileCheck2Icon,
  SplitIcon,
  TrainFrontIcon,
} from "lucide-react";
import Link from "next/link";

import { AppNavigation } from "@/components/app-navigation";
import { Aura } from "@/components/brand/aura";
import {
  StatCell,
  StatDetail,
  StatGrid,
  StatLabel,
  StatNumber,
} from "@/components/brand/stat-grid";
import {
  TerminalCard,
  TerminalDots,
  TerminalStatus,
} from "@/components/brand/terminal-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const journeySteps = [
  {
    icon: TrainFrontIcon,
    titleKey: "landing.journey.train.title",
    detailKey: "landing.journey.train.detail",
    amount: "€142.80",
  },
  {
    icon: FileCheck2Icon,
    titleKey: "landing.journey.receipt.title",
    detailKey: "landing.journey.receipt.detail",
    statusKey: "landing.journey.receipt.status",
  },
  {
    icon: SplitIcon,
    titleKey: "landing.journey.allocation.title",
    detailKey: "landing.journey.allocation.detail",
    amount: "€71.40",
  },
] as const;

// The localized routes serve every request (the proxy rewrites unprefixed
// paths), so the root copy only needs a blocking fallback render.
export const instant = false;

export default async function LandingPage() {
  const t = await getTranslations("shell");

  return (
    <main className="min-h-svh overflow-hidden">
      <header>
        <AppNavigation
          actions={
            <>
              <Link
                className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
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
            </>
          }
        />
      </header>

      <section className="relative mx-auto grid w-full max-w-7xl items-center gap-16 px-5 pt-10 pb-20 sm:px-8 sm:pt-14 lg:grid-cols-[1.04fr_0.96fr] lg:px-10 lg:pt-16 lg:pb-28">
        <Aura className="absolute -top-32 left-1/2 h-72 w-180 -translate-x-1/2" />
        <div className="relative max-w-2xl">
          <Badge variant="ember-pill">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-primary"
            />
            {t("brand.edition")}
          </Badge>
          <h1 className="mt-6 type-ember-display">
            {t("landing.hero.titleLead")}{" "}
            <span className="ember-headline-accent text-primary">
              {t("landing.hero.titleAccent")}
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-lg/8 text-muted-foreground sm:text-xl">
            {t("landing.hero.description")}
          </p>
          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              className={cn(buttonVariants({ size: "lg" }), "ember-cta group")}
              href="/register"
            >
              {t("landing.hero.start")}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
            <Link
              className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}
              href="#how-it-works"
            >
              {t("landing.hero.seeHow")}
            </Link>
          </div>
          <p className="mt-5 font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
            {t("landing.hero.trustLine")}
          </p>
        </div>

        <JourneyLedger />
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
        <StatGrid>
          <StatCell hero>
            <StatNumber>
              515<span className="text-[32px] text-primary">€</span>
            </StatNumber>
            <StatLabel>{t("landing.stats.disbursed.label")}</StatLabel>
            <StatDetail>{t("landing.stats.disbursed.detail")}</StatDetail>
          </StatCell>
          <StatCell>
            <StatNumber>
              100<span className="text-[32px] text-primary">%</span>
            </StatNumber>
            <StatLabel>{t("landing.stats.documented.label")}</StatLabel>
            <StatDetail>{t("landing.stats.documented.detail")}</StatDetail>
          </StatCell>
          <StatCell>
            <StatNumber>
              48
              <span className="text-[32px] text-primary">
                {t("landing.stats.avgReview.unit")}
              </span>
            </StatNumber>
            <StatLabel>{t("landing.stats.avgReview.label")}</StatLabel>
            <StatDetail>{t("landing.stats.avgReview.detail")}</StatDetail>
          </StatCell>
        </StatGrid>
      </section>

      <section
        className="mx-auto grid w-full max-w-7xl items-start gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:px-10 lg:py-28"
        id="how-it-works"
      >
        <div>
          <p className="type-ember-eyebrow">{t("landing.process.eyebrow")}</p>
          <h2 className="mt-4 max-w-md font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("landing.process.title")}
          </h2>
          <p className="mt-5 max-w-prose leading-7 text-muted-foreground">
            {t("landing.process.description")}
          </p>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
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
        <TerminalCard className="p-5 lg:sticky lg:top-24">
          <TerminalDots />
          <div className="mt-4 flex flex-col gap-1">
            <p>
              <span className="text-primary">✓</span>{" "}
              {t("landing.terminal.payoutAccount")}
            </p>
            <p>
              <span className="text-primary">✓</span>{" "}
              {t("landing.terminal.train")}
            </p>
            <p>
              <span className="text-primary">✓</span> {t("landing.terminal.bus")}
            </p>
            <p>
              <span className="text-muted-foreground/70">◌</span>{" "}
              {t("landing.terminal.openUpload")}
            </p>
          </div>
          <Separator className="my-4" />
          <TerminalStatus>{t("landing.terminal.status")}</TerminalStatus>
        </TerminalCard>
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
        <p className="type-ember-eyebrow">{t("landing.cta.eyebrow")}</p>
        <h2 className="mx-auto mt-4 max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t("landing.cta.title")}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
          {t("landing.cta.description")}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            className={cn(buttonVariants({ size: "lg" }), "ember-cta group")}
            href="/register"
          >
            {t("landing.hero.start")}
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>{t("landing.footer.product")}</p>
          <p>{t("landing.footer.tagline")}</p>
        </div>
      </footer>
    </main>
  );
}

async function JourneyLedger() {
  const t = await getTranslations("shell");

  return (
    <div className="relative mx-auto w-full max-w-lg lg:mr-0">
      <div className="absolute -inset-10 -z-10 rounded-full bg-accent/35 blur-3xl" />
      <div className="overflow-hidden rounded-3xl border bg-card shadow-[0_24px_70px_-45px_color-mix(in_oklch,var(--foreground),transparent_55%)]">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div>
            <p className="font-heading font-semibold">
              {t("landing.journey.project")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("landing.journey.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-primary">
            <span className="size-2 rounded-full bg-primary" />
            {t("landing.journey.windowOpen")}
          </div>
        </div>
        <div className="px-6 py-2">
          {journeySteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <div
                className="relative grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 py-5"
                key={step.titleKey}
              >
                {index < journeySteps.length - 1 && (
                  <span className="absolute top-12 left-5 h-10 w-px bg-border" />
                )}
                <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <p className="font-medium">{t(step.titleKey)}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(step.detailKey)}
                  </p>
                </div>
                <p className="font-heading text-sm font-semibold">
                  {"amount" in step ? step.amount : t(step.statusKey)}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground">
          <div className="flex items-center gap-3">
            <CheckIcon aria-hidden="true" className="size-4" />
            <span className="text-sm font-medium">
              {t("landing.journey.submissionComplete")}
            </span>
          </div>
          <span className="font-heading text-lg font-semibold">€142.80</span>
        </div>
      </div>
    </div>
  );
}

type ValuePointProps = {
  description: string;
  title: string;
};

function ValuePoint({ description, title }: ValuePointProps) {
  return (
    <article className="py-8 md:px-8 md:py-10 md:first:pl-0 md:last:pr-0">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="mt-3 max-w-sm leading-7 text-muted-foreground">
        {description}
      </p>
    </article>
  );
}

type ProcessStepProps = {
  description: string;
  number: string;
  title: string;
};

function ProcessStep({ description, number, title }: ProcessStepProps) {
  return (
    <li className="bg-card p-6 sm:min-h-52">
      <span className="flex size-8 items-center justify-center rounded-full bg-secondary font-heading text-sm font-semibold text-secondary-foreground">
        {number}
      </span>
      <h3 className="mt-10 font-heading text-xl font-semibold">{title}</h3>
      <p className="mt-2 leading-7 text-muted-foreground">{description}</p>
    </li>
  );
}
