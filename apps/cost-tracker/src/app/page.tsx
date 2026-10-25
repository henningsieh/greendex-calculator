import {
  ArrowRightIcon,
  CheckIcon,
  FileCheck2Icon,
  SplitIcon,
  TrainFrontIcon,
} from "lucide-react";
import Link from "next/link";

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
import { SiteBrand } from "@/components/site-brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const journeySteps = [
  {
    icon: TrainFrontIcon,
    title: "Train to Utrecht",
    detail: "Berlin · 2 participants",
    amount: "€142.80",
  },
  {
    icon: FileCheck2Icon,
    title: "Receipt attached",
    detail: "bahn-ticket.pdf",
    amount: "Ready",
  },
  {
    icon: SplitIcon,
    title: "Cost allocated",
    detail: "Equal share",
    amount: "€71.40",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-svh overflow-hidden">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between p-5 sm:px-8 lg:px-10">
        <SiteBrand />
        <nav aria-label="Account" className="flex items-center gap-2 sm:gap-3">
          <ThemeSwitcher />
          <Link
            className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className={cn(
              buttonVariants({ size: "sm" }),
              "hidden sm:inline-flex",
            )}
            href="/register"
          >
            Create account
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto grid w-full max-w-7xl items-center gap-16 px-5 pt-10 pb-20 sm:px-8 sm:pt-14 lg:grid-cols-[1.04fr_0.96fr] lg:px-10 lg:pt-16 lg:pb-28">
        <Aura className="absolute -top-32 left-1/2 h-72 w-[720px] -translate-x-1/2" />
        <div className="relative max-w-2xl">
          <Badge variant="ember-pill">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-primary"
            />
            GreenDex Cost Tracker · Erasmus Edition
          </Badge>
          <h1 className="mt-6 type-ember-display">
            Receipts in.{" "}
            <span className="ember-headline-accent text-primary">Money out.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg/8 text-muted-foreground sm:text-xl">
            Settle Erasmus travel costs without the spreadsheet struggle. Snap a
            photo of the ticket, share the cost, file the claim — every number
            stays traceable to its receipt.
          </p>
          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              className={cn(buttonVariants({ size: "lg" }), "ember-cta group")}
              href="/register"
            >
              Start tracking costs
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
            <Link
              className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}
              href="#how-it-works"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-5 font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
            Free to start · No credit card · Demo data below
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
            <StatLabel>Disbursed</StatLabel>
            <StatDetail>calculated · not editable</StatDetail>
          </StatCell>
          <StatCell>
            <StatNumber>
              100<span className="text-[32px] text-primary">%</span>
            </StatNumber>
            <StatLabel>Documented</StatLabel>
            <StatDetail>zero open gaps</StatDetail>
          </StatCell>
          <StatCell>
            <StatNumber>
              48<span className="text-[32px] text-primary">h</span>
            </StatNumber>
            <StatLabel>Avg. review time</StatLabel>
            <StatDetail>hosting review</StatDetail>
          </StatCell>
        </StatGrid>
      </section>

      <section
        className="mx-auto grid w-full max-w-7xl items-start gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:px-10 lg:py-28"
        id="how-it-works"
      >
        <div>
          <p className="type-ember-eyebrow">The process</p>
          <h2 className="mt-4 max-w-md font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            One claim. Zero follow-up questions.
          </h2>
          <p className="mt-5 max-w-prose leading-7 text-muted-foreground">
            The workspace checks everything before you submit: payout account,
            cost entries, receipt links, frozen funding rates. What is missing
            shows up as a checklist — not as an email three weeks later.
          </p>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
            <ProcessStep
              description="Choose the project and enter the exact journey cost."
              number="1"
              title="Record"
            />
            <ProcessStep
              description="Add receipts, invoices, or tickets as proof documents."
              number="2"
              title="Support"
            />
            <ProcessStep
              description="Assign the cost to the participants it covered."
              number="3"
              title="Allocate"
            />
          </ol>
        </div>
        <TerminalCard className="p-5 lg:sticky lg:top-24">
          <TerminalDots />
          <div className="mt-4 flex flex-col gap-1">
            <p>
              <span className="text-primary">✓</span> Payout account · Green
              Routes e.V.
            </p>
            <p>
              <span className="text-primary">✓</span> Train · €428.60 · receipt
              linked
            </p>
            <p>
              <span className="text-primary">✓</span> Bus · €86.40 · receipt
              linked
            </p>
            <p>
              <span className="text-muted-foreground/70">◌</span> Local bus
              tickets · upload open
            </p>
          </div>
          <Separator className="my-4" />
          <TerminalStatus>€515.00 ready for submission</TerminalStatus>
        </TerminalCard>
      </section>

      <section className="border-y bg-card/60">
        <div className="mx-auto grid w-full max-w-7xl divide-y px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-10">
          <ValuePoint
            description="Attach the document once and connect it to the costs it supports."
            title="Proof stays with the cost"
          />
          <ValuePoint
            description="Split a ticket equally, by percentage, or by exact EUR amount."
            title="Group travel stays legible"
          />
          <ValuePoint
            description="Hosting and Partner Organizations see one project-specific record."
            title="Partners stay aligned"
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-20 text-center sm:px-8 lg:px-10 lg:py-28">
        <p className="type-ember-eyebrow">Free to start</p>
        <h2 className="mx-auto mt-4 max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          Ready for your next claim?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
          Upload the photo. Share the cost. Get the money back.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            className={cn(buttonVariants({ size: "lg" }), "ember-cta group")}
            href="/register"
          >
            Start tracking costs
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>Greendex Cost Tracker</p>
          <p>Clear records for shared travel.</p>
        </div>
      </footer>
    </main>
  );
}

function JourneyLedger() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:mr-0">
      <div className="absolute -inset-10 -z-10 rounded-full bg-accent/35 blur-3xl" />
      <div className="overflow-hidden rounded-3xl border bg-card shadow-[0_24px_70px_-45px_color-mix(in_oklch,var(--foreground),transparent_55%)]">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div>
            <p className="font-heading font-semibold">Spring workshop</p>
            <p className="text-sm text-muted-foreground">Travel cost trail</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-primary">
            <span className="size-2 rounded-full bg-primary" />
            Window open
          </div>
        </div>
        <div className="px-6 py-2">
          {journeySteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <div
                className="relative grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 py-5"
                key={step.title}
              >
                {index < journeySteps.length - 1 && (
                  <span className="absolute top-12 left-5 h-10 w-px bg-border" />
                )}
                <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                </div>
                <p className="font-heading text-sm font-semibold">
                  {step.amount}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground">
          <div className="flex items-center gap-3">
            <CheckIcon aria-hidden="true" className="size-4" />
            <span className="text-sm font-medium">Submission complete</span>
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
