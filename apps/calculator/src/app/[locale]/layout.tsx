import { NextIntlClientProvider } from "@greendex/i18n/client";
import {
  getMessages,
  getTimeZone,
  setRequestLocale,
} from "@greendex/i18n/server";
import { cacheLife } from "next/cache";
import { Comfortaa, DM_Sans, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import "@/lib/orpc/client.server";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { isSupportedLocale } from "@/lib/i18n/locales";
import { routing } from "@/lib/i18n/routing";

const clashDisplay = localFont({
  src: "./../../../public/fonts/ClashDisplay_Complete/Fonts/TTF/ClashDisplay-Variable.ttf",
  variable: "--font-clash",
  display: "swap",
});

const spaceGrotesk = Comfortaa({
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const dmSans = DM_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

interface Props {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({
    locale,
  }));
}

/**
 * Reference timestamp for the intl provider. Cached with the longest
 * lifetime: nothing in the app reads relative time (`useNow` has no
 * consumers), so the value is inert — but the provider requires a concrete
 * `now` to skip its request-time lookup during prerendering.
 */
async function getPrerenderNow() {
  "use cache";
  cacheLife("max");
  return new Date();
}

export default function LocaleLayout({ children, params }: Props) {
  return (
    <div
      className={`${clashDisplay.variable} ${spaceGrotesk.variable} ${dmSans.className} ${dmSans.variable} ${jetbrainsMono.variable} scroll-smooth`}
    >
      {/* Preconnect to external resources for performance */}
      <link href="https://fonts.googleapis.com" rel="preconnect" />
      <link
        crossOrigin="anonymous"
        href="https://fonts.gstatic.com"
        rel="preconnect"
      />
      <ThemeProvider>
        <QueryProvider>
          <Suspense fallback={<LocaleSkeleton />}>
            <LocalizedIntl params={params}>{children}</LocalizedIntl>
          </Suspense>
        </QueryProvider>
      </ThemeProvider>
    </div>
  );
}

async function LocalizedIntl({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Providing all messages to the client side is the easiest way to get started
  // NOTE (Cache Components, #246): explicit `locale` keeps these calls out of
  // the request-header lookup, so the layout prerenders statically.
  const messages = await getMessages({ locale });
  const timeZone = await getTimeZone({ locale });
  const now = await getPrerenderNow();

  return (
    <div lang={locale}>
      {/* NOTE (Cache Components, #246): every prop is explicit — without
          them the provider fills locale/timeZone/now/formats via a
          request-time lookup, so the route stays protected (no prerender).
          `now` is frozen
          per prerender (no `useNow` consumers exist); `formats` stays
          empty as the request config defines none. */}
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

function LocaleSkeleton() {
  return (
    <div aria-hidden="true" className="min-h-screen">
      <div className="mx-auto mt-3 h-14 max-w-5xl animate-pulse rounded-2xl bg-muted/40" />
      <div className="mx-auto mt-16 max-w-4xl space-y-6 px-4 text-center">
        <div className="mx-auto h-16 w-3/4 animate-pulse rounded-2xl bg-muted/60" />
        <div className="mx-auto h-6 w-2/3 animate-pulse rounded-xl bg-muted/40" />
        <div className="mx-auto h-12 w-56 animate-pulse rounded-full bg-muted/60" />
      </div>
    </div>
  );
}
