import { getTranslations, setRequestLocale } from "@greendex/i18n/server";
import { createParser } from "nuqs/server";
import { Suspense } from "react";

import { NuqsProvider } from "@/components/providers/nuqs-adapter";
import { WorkshopContent } from "@/features/landingpage/components/workshops/workshop-tab-select";
import type { WorkshopType } from "@/features/landingpage/types";

const typeParser = createParser({
  parse: (value: unknown) => {
    if (value === "moment" || value === "deal" || value === "day") {
      return value as "moment" | "deal" | "day";
    }

    return "moment";
  },
  serialize: (value: unknown) => String(value),
});

/**
 * Render the Workshops page with a statically prerendered shell.
 *
 * The tab selection reads `searchParams.type` (request-time data), so it
 * streams in behind a Suspense boundary together with the nuqs adapter
 * context the client-side tabs require. The header above stays static.
 *
 * @param params - Route params carrying the `[locale]` segment.
 * @param searchParams - An object or Promise resolving to an object that may contain a `type` query parameter used to select the initial workshop tab.
 * @returns A JSX element representing the Workshops page layout with the parsed initial workshop type applied to `WorkshopContent`.
 */
export default async function WorkshopsPage({
  params,
  searchParams,
}: {
  params: Promise<{
    locale: string;
  }>;
  searchParams:
    | Promise<{
        type?: string;
      }>
    | {
        type?: string;
      };
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: "landingPage.workshops",
  });

  return (
    <main className="relative min-h-screen py-28">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6">
        {/* Enhanced Header */}
        <div className="mb-12 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 backdrop-blur-sm">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold tracking-wider text-primary uppercase">
              {t("badge")}
            </span>
          </div>

          <h1 className="mb-6 text-4xl font-semibold tracking-tight text-balance lg:text-5xl">
            {t("headingPrefix")}{" "}
            <span className="bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400">
              {t("headingEmphasis")}
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t("pageSubtitle")}
          </p>
        </div>

        {/* Client-side interactive tabs and content. The server-parsed initial
            type and the nuqs adapter context stream in; the shell above is
            already visible. */}
        <Suspense fallback={<WorkshopTabsSkeleton />}>
          <WorkshopTypeFromSearchParams searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

/**
 * Resolve the initial workshop tab from the URL query string and provide the
 * nuqs adapter context for the client-side tab state.
 *
 * Runs inside Suspense: `searchParams` is request-time data. The parser
 * accepts `"moment" | "deal" | "day"` and falls back to `"moment"` when the
 * parameter is absent or unrecognized.
 */
async function WorkshopTypeFromSearchParams({
  searchParams,
}: {
  searchParams:
    | Promise<{
        type?: string;
      }>
    | {
        type?: string;
      };
}) {
  const params = await searchParams;
  const type =
    (typeParser.parse((params?.type ?? "") as string) as WorkshopType) ??
    "moment";

  return (
    <NuqsProvider>
      <WorkshopContent initialType={type} />
    </NuqsProvider>
  );
}

/**
 * Deterministic placeholder approximating the tab layout while the
 * search-param-driven tab selection streams in.
 */
function WorkshopTabsSkeleton() {
  return (
    <div className="w-full" aria-hidden="true">
      <div className="grid w-full grid-cols-3 gap-1 rounded-lg bg-secondary/40 p-1">
        <div className="h-9 rounded-md bg-muted/60" />
        <div className="h-9 rounded-md bg-muted/60" />
        <div className="h-9 rounded-md bg-muted/60" />
      </div>
      <div className="mt-8 h-64 rounded-lg bg-muted/40" />
    </div>
  );
}
