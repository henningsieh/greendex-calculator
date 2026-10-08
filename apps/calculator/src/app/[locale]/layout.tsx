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

/**
 * Provide localized messages, time zone, and a cached reference time alongside
 * theme and query providers for the page content.
 *
 * Set the request locale from `params`; unsupported locales trigger Next.js
 * not-found handling. Message and time-zone loading failures propagate.
 */
export default async function LocaleLayout({ children, params }: Props) {
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
    <div
      className={`${clashDisplay.variable} ${spaceGrotesk.variable} ${dmSans.className} ${dmSans.variable} ${jetbrainsMono.variable} scroll-smooth`}
      lang={locale}
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
        </QueryProvider>
      </ThemeProvider>
    </div>
  );
}
