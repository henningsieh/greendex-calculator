import {
  ArrowRightIcon,
  CheckIcon,
  FileCheck2Icon,
  SplitIcon,
  TrainFrontIcon,
} from "lucide-react";
import Link from "next/link";

import { SiteBrand } from "@/components/site-brand";
import { buttonVariants } from "@/components/ui/button";
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
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <SiteBrand />
        <nav aria-label="Account" className="flex items-center gap-2">
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

      <section className="mx-auto grid w-full max-w-7xl items-center gap-16 px-5 pt-14 pb-20 sm:px-8 sm:pt-20 lg:grid-cols-[1.04fr_0.96fr] lg:px-10 lg:pt-24 lg:pb-28">
        <div className="max-w-2xl">
          <h1 className="max-w-xl font-heading text-5xl font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-7xl">
            Every journey cost, accounted for.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
            Collect travel receipts, allocate shared costs, and keep every Project
            Participant working from the same clear record.
          </p>
          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              className={cn(buttonVariants({ size: "lg" }), "group")}
              href="/register"
            >
              Start tracking costs
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
            <p className="text-sm text-muted-foreground">
              Built for shared Project travel.
            </p>
          </div>
        </div>

        <JourneyLedger />
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
            description="Hosting and Partner Organizations see one Project-specific record."
            title="Partners stay aligned"
          />
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-10 lg:py-28">
        <div>
          <h2 className="max-w-md font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            A straightforward path from ticket to total.
          </h2>
        </div>
        <ol className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
          <ProcessStep
            description="Choose the Project and enter the exact journey cost."
            number="1"
            title="Record"
          />
          <ProcessStep
            description="Add receipts, invoices, or tickets as Proof Documents."
            number="2"
            title="Support"
          />
          <ProcessStep
            description="Assign the cost to the Participants it covered."
            number="3"
            title="Allocate"
          />
        </ol>
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
