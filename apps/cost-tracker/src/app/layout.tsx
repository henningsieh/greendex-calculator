import "@/lib/orpc/client.server";
import { DEFAULT_LANGUAGE } from "@greendex/config/languages";
import { NextIntlClientProvider } from "@greendex/i18n/client";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Geist, Inter, JetBrains_Mono } from "next/font/google";

import { NuqsProvider } from "@/components/nuqs-provider";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import shellMessages from "@/messages/en/shell.json";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

// Cached reference keeps the root provider's formatter clock unchanged during
// prerendering instead of reading the current time.
async function getShellNow() {
  "use cache";
  cacheLife("max");
  return new Date();
}

export const metadata: Metadata = {
  applicationName: "Cost Tracker",
  title: {
    default: "Cost Tracker",
    template: "%s | Cost Tracker",
  },
  description:
    "Organize Project travel costs, Proof Documents, and Cost Allocations.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const now = await getShellNow();

  return (
    <html
      lang={DEFAULT_LANGUAGE}
      suppressHydrationWarning
      className={cn(
        "font-sans antialiased",
        fontMono.variable,
        geist.variable,
        inter.variable,
      )}
    >
      <body>
        {/* Unprefixed root routes render outside the localized layout and still
            need the shell catalog to prerender and hydrate. */}
        <NextIntlClientProvider
          formats={{}}
          locale={DEFAULT_LANGUAGE}
          messages={shellMessages}
          now={now}
          timeZone="UTC"
        >
          <Toaster>
            <ThemeProvider>
              <NuqsProvider>
                <QueryProvider>{children}</QueryProvider>
              </NuqsProvider>
            </ThemeProvider>
          </Toaster>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
