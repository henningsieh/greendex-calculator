import { NextIntlClientProvider } from "@greendex/i18n/client";
import {
  getMessages,
  getTimeZone,
  setRequestLocale,
} from "@greendex/i18n/server";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { isSupportedLocale } from "@/lib/i18n/locales";
import { routing } from "@/lib/i18n/routing";
import type { LocaleParams } from "@/lib/i18n/types";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// No relative-time consumers exist; a cached reference avoids request-time lookup.
async function getPrerenderNow() {
  "use cache";
  cacheLife("max");
  return new Date();
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<LocaleParams>;
}) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="min-h-screen" />}>
      <LocalizedIntl params={params}>{children}</LocalizedIntl>
    </Suspense>
  );
}

async function LocalizedIntl({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<LocaleParams>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);

  const [messages, timeZone, now] = await Promise.all([
    getMessages({ locale }),
    getTimeZone({ locale }),
    getPrerenderNow(),
  ]);

  return (
    <div lang={locale}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone={timeZone}
        now={now}
        formats={{}}
      >
        {children}
      </NextIntlClientProvider>
    </div>
  );
}
