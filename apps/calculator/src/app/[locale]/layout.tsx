import { NextIntlClientProvider } from "@greendex/i18n/client";
import { getMessages, setRequestLocale } from "@greendex/i18n/server";
import { Comfortaa, DM_Sans, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { notFound } from "next/navigation";

import { NuqsProvider } from "@/components/providers/nuqs-adapter";
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

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Providing all messages to the client side is the easiest way to get started
  const messages = await getMessages();

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
        <NuqsProvider>
          <QueryProvider>
            <NextIntlClientProvider messages={messages}>
              {children}
            </NextIntlClientProvider>
          </QueryProvider>
        </NuqsProvider>
      </ThemeProvider>
    </div>
  );
}
