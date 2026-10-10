import { LANGUAGE_CODES, SUPPORTED_LANGUAGES } from "@greendex/config/languages";
import { defineI18nUI } from "fumadocs-ui/i18n";
import { RootProvider } from "fumadocs-ui/provider/next";

import "src/app/globals.css";
import { Inter } from "next/font/google";
import { Suspense } from "react";

import { i18n } from "@/lib/i18n";

const inter = Inter({
  subsets: ["latin"],
});

const { provider } = defineI18nUI(
  i18n,
  SUPPORTED_LANGUAGES.reduce(
    (acc, locale) => {
      acc[locale.code] = {
        displayName: locale.label,
      };
      return acc;
    },
    {} as {
      [key: string]: Partial<{
        displayName: string;
      }>;
    },
  ),
);

// export default function Layout({ children }: LayoutProps<"">) {
/**
 * Return one route parameter set per configured documentation language
 * for prerendering.
 */
export function generateStaticParams() {
  return LANGUAGE_CODES.map((lang) => ({ lang }));
}

export default function RootLayout({ params, children }: LayoutProps<"/[lang]">) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Suspense fallback={<DocsRootSkeleton />}>
          <LocalizedRootProvider params={params}>
            {children}
          </LocalizedRootProvider>
        </Suspense>
      </body>
    </html>
  );
}

async function LocalizedRootProvider({
  params,
  children,
}: Pick<LayoutProps<"/[lang]">, "params"> & {
  children: React.ReactNode;
}) {
  const lang = (await params).lang;
  return <RootProvider i18n={provider(lang)}>{children}</RootProvider>;
}

function DocsRootSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-h-screen flex-col">
      <div className="h-14 animate-pulse border-b bg-muted/40" />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-6 py-10">
        <div className="hidden w-64 shrink-0 space-y-3 md:block">
          <div className="h-6 w-3/4 animate-pulse rounded-sm bg-muted/60" />
          <div className="h-6 w-full animate-pulse rounded-sm bg-muted/40" />
          <div className="h-6 w-5/6 animate-pulse rounded-sm bg-muted/40" />
          <div className="h-6 w-2/3 animate-pulse rounded-sm bg-muted/40" />
        </div>
        <div className="flex-1 space-y-4">
          <div className="h-10 w-1/2 animate-pulse rounded-xl bg-muted/60" />
          <div className="h-4 w-full animate-pulse rounded-sm bg-muted/40" />
          <div className="h-4 w-5/6 animate-pulse rounded-sm bg-muted/40" />
          <div className="h-4 w-2/3 animate-pulse rounded-sm bg-muted/40" />
        </div>
      </div>
    </div>
  );
}
