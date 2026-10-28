"use client";

import { useTranslations } from "@greendex/i18n/client";
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
  const t = useTranslations("shell");
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
            <span className="text-[19px] font-extrabold">{t("brand.name")}</span>
            <span className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
              {t("brand.product")}
            </span>
          </div>
        </div>
        <Badge variant="ember-pill">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          {t("brand.edition")}
        </Badge>
        <h1 className="type-ember-display">
          {t("designSystem.titleLead")}{" "}
          <span className="ember-headline-accent text-primary">
            {t("designSystem.titleAccent")}
          </span>{" "}
          {t("designSystem.titleTail")}
        </h1>
        <p className="max-w-xl text-muted-foreground">
          {t("designSystem.intro")}
        </p>
      </header>

      <Section
        eyebrow={t("designSystem.themes.eyebrow")}
        title={t("designSystem.themes.title")}
      >
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
          {t("designSystem.themes.active")}{" "}
          {mounted ? (theme ?? t("designSystem.themes.system")) : "…"}
        </p>
      </Section>

      <Section
        eyebrow={t("designSystem.tokens.eyebrow")}
        title={t("designSystem.tokens.title")}
      >
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
              <span className="font-mono text-xs opacity-70">
                {t("designSystem.tokens.sample")}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow={t("designSystem.buttons.eyebrow")}
        title={t("designSystem.buttons.title")}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="default">{t("designSystem.buttons.primary")}</Button>
            <Button variant="ghost">{t("designSystem.buttons.ghost")}</Button>
            <Button variant="outline">{t("designSystem.buttons.outline")}</Button>
            <Button variant="secondary">
              {t("designSystem.buttons.secondary")}
            </Button>
            <Button variant="cta">{t("designSystem.buttons.mainCta")}</Button>
            <Button variant="link">{t("designSystem.buttons.link")}</Button>
            <Button variant="destructive">
              {t("designSystem.buttons.destructive")}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="default" disabled>
              {t("designSystem.buttons.disabledPrimary")}
            </Button>
            <Button variant="ghost" disabled>
              {t("designSystem.buttons.disabledGhost")}
            </Button>
            <PendingButton> {t("designSystem.buttons.saving")}</PendingButton>
            <Button variant="default" size="sm">
              {t("designSystem.buttons.small")}
            </Button>
            <Button variant="default" size="lg">
              {t("designSystem.buttons.large")}
            </Button>
          </div>
          <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Spinner /> {t("designSystem.buttons.spinnerNote")}
          </p>
        </div>
      </Section>

      <Section
        eyebrow={t("designSystem.cards.eyebrow")}
        title={t("designSystem.cards.title")}
      >
        <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
          <Card variant="ember">
            <CardHeader>
              <CardTitle>{t("designSystem.cards.hoverTitle")}</CardTitle>
              <CardDescription>
                {t("designSystem.cards.hoverDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm">
                {t("designSystem.cards.hoverAction")}
              </Button>
            </CardContent>
          </Card>
          <Card variant="ember-active">
            <CardHeader>
              <CardTitle>{t("designSystem.cards.activeTitle")}</CardTitle>
              <CardDescription>
                {t("designSystem.cards.activeDescription")}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card variant="ember" disabled>
            <CardHeader>
              <CardTitle>{t("designSystem.cards.exemptTitle")}</CardTitle>
              <CardDescription>
                {t("designSystem.cards.exemptDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PendingButton>
                {t("designSystem.cards.exemptAction")}
              </PendingButton>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        eyebrow={t("designSystem.type.eyebrow")}
        title={t("designSystem.type.title")}
      >
        <div className="flex flex-col gap-6">
          <div className="type-ember-display text-[clamp(40px,6vw,72px)]">
            {t("designSystem.type.headline")}
          </div>
          <p className="type-ember-eyebrow">{t("designSystem.type.label")}</p>
          <div className="type-ember-stat-number">
            56<span className="text-primary">€</span>
          </div>
          <p className="max-w-prose text-muted-foreground">
            {t("designSystem.type.body")}
          </p>
        </div>
      </Section>

      <Section
        eyebrow={t("designSystem.brand.eyebrow")}
        title={t("designSystem.brand.title")}
      >
        <StatGrid>
          <StatCell hero>
            <StatNumber>
              12<span className="text-[32px] text-primary">★</span>
            </StatNumber>
            <StatLabel>{t("designSystem.brand.heroLabel")}</StatLabel>
            <StatDetail>{t("designSystem.brand.heroDetail")}</StatDetail>
          </StatCell>
          <StatCell>
            <StatNumber>
              248<span className="text-[32px] text-primary">€</span>
            </StatNumber>
            <StatLabel>{t("designSystem.brand.claimsLabel")}</StatLabel>
            <StatDetail>{t("designSystem.brand.claimsDetail")}</StatDetail>
          </StatCell>
          <StatCell>
            <StatNumber>
              96<span className="text-[32px] text-primary">%</span>
            </StatNumber>
            <StatLabel>{t("designSystem.brand.conformityLabel")}</StatLabel>
            <StatDetail>{t("designSystem.brand.conformityDetail")}</StatDetail>
          </StatCell>
        </StatGrid>
        <TerminalCard className="p-5">
          <TerminalDots />
          <div className="mt-4 flex flex-col gap-1">
            <p>
              <span className="text-primary">✓</span>{" "}
              {t("designSystem.terminal.tokens")}
            </p>
            <p>
              <span className="text-primary">✓</span>{" "}
              {t("designSystem.terminal.buttons")}
            </p>
            <p>
              <span className="text-muted-foreground/70">◌</span>{" "}
              {t("designSystem.terminal.landing")}
            </p>
          </div>
          <Separator className="my-4" />
          <TerminalStatus>{t("designSystem.terminal.status")}</TerminalStatus>
        </TerminalCard>
      </Section>
    </div>
  );
}
