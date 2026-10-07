import { getTranslations } from "@greendex/i18n/server";
import { createParser } from "nuqs/server";

import { WorkshopContent } from "@/features/landingpage/components/workshops/workshop-tab-select";

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
 * Render the Workshops page and determine the initial workshop type from the provided search parameters.
 *
 * The function reads `searchParams.type`, parses it into one of `"moment" | "deal" | "day"`, and falls back to `"moment"` when absent or unrecognized. The parsed value is passed as the `initialType` prop to the client-side `WorkshopContent` component.
 *
 * @param searchParams - An object or Promise resolving to an object that may contain a `type` query parameter used to select the initial workshop tab.
 * @returns A JSX element representing the Workshops page layout with the parsed initial workshop type applied to `WorkshopContent`.
 */
export default async function WorkshopsPage({
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
  const t = await getTranslations("landingPage.workshops");
  const params = await searchParams;
  const type =
    (typeParser.parse((params?.type ?? "") as string) as
      | "moment"
      | "deal"
      | "day") ?? "moment";

  return (
    <main className="relative min-h-screen py-28">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 size-96 rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6">
        {/* Enhanced Header */}
        <div className="mb-12 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 backdrop-blur-sm">
            <span className="flex size-2 animate-pulse rounded-full bg-emerald-500" />
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

        {/* Client-side interactive tabs and content. Pass server-parsed initial type. */}
        <WorkshopContent initialType={type} />
      </div>
    </main>
  );
}
