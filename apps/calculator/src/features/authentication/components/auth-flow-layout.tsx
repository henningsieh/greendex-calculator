import { getTranslations } from "@greendex/i18n/server";
import type { ReactNode } from "react";

import { BackToHome } from "@/features/authentication/components/back-to-home";
import { RightSideImage } from "@/features/authentication/components/right-side-image";
import { LandingPageBackground } from "@/features/landingpage/components/landing-page-background";
import { cn } from "@/lib/utils";

const highlightKeys = ["one", "two", "three"] as const;

interface AuthFlowLayoutProps {
  children: ReactNode;
  backLabel?: string;
  backHref?: string;
  locale: string;
}

export function normalizeRedirectPath(
  nextPageUrl: string | string[] | undefined,
  fallbackPath: string,
): string {
  let normalizedRedirect: string | undefined;
  if (typeof nextPageUrl === "string") {
    normalizedRedirect = nextPageUrl;
  } else if (Array.isArray(nextPageUrl)) {
    normalizedRedirect = nextPageUrl[0];
  } else {
    normalizedRedirect = undefined;
  }
  return normalizedRedirect ?? fallbackPath;
}

/**
 * Layout used for authentication pages that presents a left content panel (with an optional back link and badge) and a translated right-side hero image.
 *
 * Renders children inside the left panel; the right side displays translated headline, description, hero fields, and highlights.
 *
 * @param children - Content to render in the left panel of the layout
 * @param backHref - Optional URL for the back link; when omitted the back control is rendered without a destination
 * @param backLabel - Optional label for the back link; defaults to "Back to Home" when not provided
 * @returns A React element containing the authentication layout
 */
export default async function AuthFlowLayout({
  children,
  backHref,
  backLabel,
  locale,
}: AuthFlowLayoutProps) {
  // NOTE (Cache Components, #246): explicit `locale` — the header-backed
  // lookup resolves per segment, so a bare call would block prerendering.
  const t = await getTranslations({ locale, namespace: "authentication.brand" });
  const highlights = highlightKeys.map((key) => t(`values.${key}`));

  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      <LandingPageBackground />

      <div className="relative mx-auto flex min-h-svh max-w-7xl flex-col gap-6 p-4 sm:px-6 sm:py-8 md:px-8">
        {/* Back to Home button positioned outside cards */}
        <div className="w-full max-w-7xl">
          <BackToHome href={backHref} label={backLabel ?? "Back to Home"} />
        </div>

        {/* Cards container with equal heights */}
        <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
          {/* Left card - Form content */}
          <div
            className={cn(
              "mx-auto w-full max-w-xl",
              "flex flex-col rounded-xl border border-border/40 bg-card/60 p-6 backdrop-blur-xl",
              "lg:mx-0 lg:w-1/2 lg:max-w-none",
              "lg:p-8",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold tracking-wider text-primary uppercase">
                {t("badge")}
              </span>
            </div>

            <div className="mt-6 flex-1">{children}</div>
          </div>

          {/* Right card - Hero image with equal height */}
          <RightSideImage
            description={t("description")}
            headline={t("headline")}
            heroBadge={t("heroBadge")}
            heroCaption={t("heroCaption")}
            heroStatOne={t("heroStatOne")}
            heroStatTwo={t("heroStatTwo")}
            heroTitle={t("heroTitle")}
            highlights={highlights}
          />
        </div>
      </div>
    </div>
  );
}
