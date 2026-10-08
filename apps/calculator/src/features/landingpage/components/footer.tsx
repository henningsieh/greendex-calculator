import { getTranslations } from "@greendex/i18n/server";
import { cacheLife } from "next/cache";

import {
  ABOUT_PATH,
  DASHBOARD_PATH,
  E_FOREST_PATH,
  HOME_PATH,
  LIBRARY_PATH,
  LOGIN_PATH,
  SIGNUP_PATH,
  TIPS_AND_TRICKS_PATH,
  WORKSHOPS_ANCHOR,
} from "@/app/routes";
import { Logo } from "@/features/landingpage/components/logo";
import { PillCTA } from "@/features/landingpage/components/pill-cta";
import { Link } from "@/lib/i18n/routing";

/**
 * Renders the site's footer section with the logo, a launch CTA, and localized navigation columns.
 *
 * Uses translations from "LandingPage" and "header" to populate link titles and builds the Explore, Company,
 * and App link groups. Also includes a CTA to the dashboard and a copyright line with the current year.
 *
 * @returns A JSX element representing the footer containing the logo, CTA, localized navigation links, and copyright.
 */
/**
 * Copyright year for the footer. Cached with the longest lifetime: the value
 * only changes at the year boundary, so it is safe to bake into the prerender
 * (Cache Components treats `new Date()` as unstable otherwise).
 */
async function getCurrentYear() {
  // AUDIT-EXPERIMENT: directive removed
  // AUDIT-EXPERIMENT: cacheLife removed
  return new Date().getFullYear();
}

export async function FooterSection({ locale }: { locale: string }) {
  // NOTE (Cache Components, #246): explicit `locale` — the header-backed
  // lookup resolves per segment, so a bare call would block prerendering.
  const t = await getTranslations({ locale, namespace: "landingPage" });

  const navigationLinks = [
    {
      title: t("header.navigation.workshops"),
      href: WORKSHOPS_ANCHOR,
    },
    {
      title: t("header.navigation.eforest"),
      href: E_FOREST_PATH,
    },
    {
      title: t("header.navigation.tipsAndTricks"),
      href: TIPS_AND_TRICKS_PATH,
    },
    {
      title: t("header.navigation.library"),
      href: LIBRARY_PATH,
    },
  ];

  const companyLinks = [
    {
      title: t("header.navigation.about"),
      href: ABOUT_PATH,
    },
  ];

  const appLinks = [
    {
      title: t("header.navigation.login"),
      href: LOGIN_PATH,
    },
    {
      title: t("header.navigation.signup"),
      href: SIGNUP_PATH,
    },
  ];

  return (
    <footer className="border-t bg-background/50 pt-16 pb-10 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link
              aria-label="GREENDEX home"
              className="block size-fit"
              locale={locale}
              href={HOME_PATH}
            >
              <Logo />
            </Link>
            <div className="mt-6">
              <PillCTA href={DASHBOARD_PATH} locale={locale}>
                {t("launchButton")}
              </PillCTA>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-3">
            <div className="space-y-4 text-sm">
              <span className="block font-semibold text-foreground">
                {t("footer.explore")}
              </span>
              <div className="flex flex-col space-y-3">
                {navigationLinks.map((item, index) => (
                  <Link
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    locale={locale}
                    href={item.href}
                    key={index}
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <span className="block font-semibold text-foreground">
                {t("footer.company")}
              </span>
              <div className="flex flex-col space-y-3">
                {companyLinks.map((item, index) => (
                  <Link
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    locale={locale}
                    href={item.href}
                    key={index}
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <span className="block font-semibold text-foreground">
                {t("footer.app")}
              </span>
              <div className="flex flex-col space-y-3">
                {appLinks.map((item, index) => (
                  <Link
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    locale={locale}
                    href={item.href}
                    key={index}
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <span className="text-center text-sm text-muted-foreground sm:text-left">
            &copy; {await getCurrentYear()} Greendex | {t("footer.copyright")}
          </span>
        </div>
      </div>
    </footer>
  );
}
