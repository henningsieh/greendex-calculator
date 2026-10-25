"use client";

import { useTheme } from "next-themes";
import * as React from "react";

import { Aura } from "@/components/brand/aura";
import { PendingButton } from "@/components/brand/pending-button";
import { StarWreath } from "@/components/brand/star-wreath";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="type-ember-eyebrow">{eyebrow}</p>
        <h2 className="text-3xl font-extrabold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const TOKEN_PAIRS: { bg: string; fg: string; label: string }[] = [
  {
    bg: "bg-background",
    fg: "text-foreground",
    label: "background / foreground",
  },
  {
    bg: "bg-primary",
    fg: "text-primary-foreground",
    label: "primary / primary-foreground",
  },
  {
    bg: "bg-secondary",
    fg: "text-secondary-foreground",
    label: "secondary / secondary-foreground",
  },
  {
    bg: "bg-muted",
    fg: "text-muted-foreground",
    label: "muted / muted-foreground",
  },
  {
    bg: "bg-accent",
    fg: "text-accent-foreground",
    label: "accent / accent-foreground",
  },
  { bg: "bg-card", fg: "text-card-foreground", label: "card / card-foreground" },
  {
    bg: "bg-popover",
    fg: "text-popover-foreground",
    label: "popover / popover-foreground",
  },
  {
    bg: "bg-pending",
    fg: "text-pending-foreground",
    label: "pending / pending-foreground",
  },
];

export default function DesignSystemPage() {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-16 px-12 py-16 max-sm:px-[18px]">
      <header className="relative flex flex-col gap-6 overflow-hidden">
        <Aura className="absolute -top-24 left-1/2 h-72 w-[720px] -translate-x-1/2" />
        <div className="flex items-center gap-3">
          <StarWreath size={34} />
          <div className="flex flex-col">
            <span className="text-[19px] font-extrabold">GreenDex</span>
            <span className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Cost Tracker
            </span>
          </div>
        </div>
        <Badge variant="ember-pill">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          GreenDex Cost Tracker · Erasmus Edition
        </Badge>
        <h1 className="type-ember-display">
          Ember <span className="ember-headline-accent text-primary">
            design
          </span>{" "}
          system
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Seven themes, one fire accent. Tokens, button matrix, cards, type
          specimen, and the locked brand extensions — rendered live.
        </p>
      </header>

      <Section eyebrow="Themes · 7 slots" title="Theme switcher">
        <div className="flex flex-wrap gap-2">
          {THEMES.map((entry) => (
            <Button
              key={entry.value}
              variant={mounted && theme === entry.value ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme(entry.value)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          active: {mounted ? (theme ?? "system") : "…"}
        </p>
      </Section>

      <Section eyebrow="Tokens · roles" title="Color roles">
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {TOKEN_PAIRS.map((pair) => (
            <div
              key={pair.label}
              className={cn(
                "flex items-center justify-between rounded-xl border border-border px-5 py-4",
                pair.bg,
                pair.fg,
              )}
            >
              <span className="text-sm font-semibold">{pair.label}</span>
              <span className="font-mono text-xs opacity-70">Aa</span>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Buttons · matrix" title="Button variants and states">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="default">Primary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="cta">Main CTA</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="default" disabled>
              Disabled primary
            </Button>
            <Button variant="ghost" disabled>
              Disabled ghost
            </Button>
            <PendingButton> saving…</PendingButton>
            <Button variant="default" size="sm">
              Small
            </Button>
            <Button variant="default" size="lg">
              Large
            </Button>
          </div>
          <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Spinner /> spinner pattern — composed, never an isPending prop
          </p>
        </div>
      </Section>

      <Section eyebrow="Cards · states" title="Card hover and active">
        <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
          <Card variant="ember">
            <CardHeader>
              <CardTitle>Hover card</CardTitle>
              <CardDescription>
                Lifts −2px with a fire border. Hover-gated, static under reduced
                motion.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm">
                Enabled action
              </Button>
            </CardContent>
          </Card>
          <Card variant="ember-active">
            <CardHeader>
              <CardTitle>Active card</CardTitle>
              <CardDescription>
                Permanent fire border with the amber wash from above.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card variant="ember" disabled>
            <CardHeader>
              <CardTitle>Exempt card</CardTitle>
              <CardDescription>
                data-disabled — stock-still, no hover, even on sticky touch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PendingButton>working…</PendingButton>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section eyebrow="Type · specimen" title="Typography">
        <div className="flex flex-col gap-6">
          <div className="type-ember-display text-[clamp(40px,6vw,72px)]">
            Riesen-Headline
          </div>
          <p className="type-ember-eyebrow">Cost Tracker · Ember C</p>
          <div className="type-ember-stat-number">
            56<span className="text-primary">€</span>
          </div>
          <p className="max-w-prose text-muted-foreground">
            Body copy stays quiet: warm white on plum-black, lavender-grey for
            secondary text. One fire accent everywhere — interaction, highlights,
            focus.
          </p>
        </div>
      </Section>

      <Section eyebrow="Brand · locked" title="Brand extensions">
        <StatGrid>
          <StatCell hero>
            <StatNumber>
              12<span className="text-[32px] text-primary">★</span>
            </StatNumber>
            <StatLabel>Hero stat</StatLabel>
            <StatDetail>amber wash · fire unit</StatDetail>
          </StatCell>
          <StatCell>
            <StatNumber>
              248<span className="text-[32px] text-primary">€</span>
            </StatNumber>
            <StatLabel>Claims</StatLabel>
            <StatDetail>seamless raster · 1px lines</StatDetail>
          </StatCell>
          <StatCell>
            <StatNumber>
              96<span className="text-[32px] text-primary">%</span>
            </StatNumber>
            <StatLabel>Conformity</StatLabel>
            <StatDetail>tabular numbers · mono labels</StatDetail>
          </StatCell>
        </StatGrid>
        <TerminalCard className="p-5">
          <TerminalDots />
          <div className="mt-4 flex flex-col gap-1">
            <p>
              <span className="text-primary">✓</span> tokens mapped — 7 themes
            </p>
            <p>
              <span className="text-primary">✓</span> buttons rebuilt — spinner
              pending
            </p>
            <p>
              <span className="text-muted-foreground/70">◌</span> landing page —
              next section
            </p>
          </div>
          <Separator className="my-4" />
          <TerminalStatus>ember-c · all systems nominal</TerminalStatus>
        </TerminalCard>
      </Section>
    </div>
  );
}
