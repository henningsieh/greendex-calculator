import { WORKSHOPS } from "@greendex/config/workshops";
import { getTranslations } from "@greendex/i18n/server";
import { ArrowRightIcon, ClockIcon } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/lib/i18n/routing";

/**
 * WorkshopsHeroSection - Most prominent section on the landing page
 * Enhanced visual treatment with glassmorphism cards
 */
export async function WorkshopsHeroSection() {
  const t = await getTranslations("landingPage");
  const intro2 = t("workshops.intro2");
  const intro2Parts = intro2.split("workshops");

  return (
    <section
      className="relative overflow-hidden border-y border-border/30 bg-linear-to-b from-background via-muted/30 to-background py-24 md:py-32 lg:py-40"
      id="workshops"
    >
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header - Enhanced */}
        <div className="mb-20 text-center">
          <Badge className="mb-12 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 backdrop-blur-sm">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold tracking-wider text-primary uppercase">
              {t("workshops.badge")}
            </span>
          </Badge>

          <h2 className="mb-8 text-4xl font-semibold tracking-tight text-balance md:text-5xl lg:text-6xl">
            {t("workshops.headingPrefix")}{" "}
            <span className="bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400">
              {t("workshops.headingEmphasis")}
            </span>
          </h2>

          <div className="mx-auto max-w-3xl space-y-6">
            <p className="text-xl leading-relaxed text-muted-foreground">
              {t("workshops.intro1")}
            </p>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {intro2Parts[0]}{" "}
              <span className="rounded-lg bg-primary/10 px-3 py-1 font-semibold text-primary">
                {t("workshops.keyword")}
              </span>{" "}
              {intro2Parts[1] ?? ""}
            </p>
          </div>
        </div>

        {/* Workshop Cards - Enhanced with better glassmorphism */}
        <div className="grid gap-8 md:grid-cols-3">
          {WORKSHOPS.map((workshop, index) => {
            const workshopId = workshop.id;
            const title = t(`workshops.types.${workshopId}.title`);
            const duration = t(`workshops.types.${workshopId}.duration`);
            const description = t(`workshops.types.${workshopId}.description`);

            // Gradient colors for each card
            const gradients = [
              "from-emerald-500/10 via-teal-500/5 to-transparent",
              "from-teal-500/10 via-cyan-500/5 to-transparent",
              "from-cyan-500/10 via-blue-500/5 to-transparent",
            ];

            return (
              <Link
                className="group block h-full"
                href={`/workshops?type=${workshop.id}`}
                key={workshop.id}
              >
                <div
                  className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/40 bg-linear-to-b ${gradients[index]} bg-card/40 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-primary/30 hover:bg-card/60 hover:shadow-2xl hover:shadow-primary/10`}
                >
                  {/* Image container */}
                  <div className="relative h-56 w-full overflow-hidden">
                    <Image
                      alt={title}
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      fill
                      loading="lazy"
                      sizes="(max-width: 768px) 100vw, 33vw"
                      src={workshop.image}
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent" />

                    {/* Duration badge - positioned on image */}
                    <div className="absolute bottom-4 left-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-sm font-semibold text-foreground shadow-lg backdrop-blur-sm">
                        <ClockIcon className="size-4 text-primary" />
                        {duration}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="mb-3 text-2xl font-bold tracking-tight">
                      {title}
                    </h3>
                    <p className="mb-6 flex-1 leading-relaxed text-muted-foreground">
                      {description}
                    </p>

                    {/* CTA */}
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <span>{t("workshops.card.learnMore")}</span>
                      <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* Hover glow effect */}
                  <div className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    <div className="absolute inset-0 bg-linear-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom Links - Enhanced */}
        <div className="mx-auto mt-20 max-w-3xl space-y-6 text-center">
          <div className="mx-auto h-px w-32 bg-linear-to-r from-transparent via-border to-transparent" />
          <p className="text-lg text-muted-foreground">
            {t("workshops.bottomP1")}
          </p>
          <p className="text-muted-foreground">
            {t("workshops.bottomP2Prefix")}{" "}
            <Link
              className="font-semibold text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
              href="/library"
            >
              {t("workshops.library")}
            </Link>{" "}
            {t("workshops.bottomP2Middle") ?? "and"}{" "}
            <Link
              className="font-semibold text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
              href="/tips-and-tricks"
            >
              {t("workshops.tipsAndTricks")}
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
