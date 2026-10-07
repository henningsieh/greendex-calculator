import { FooterSection } from "@/features/landingpage/components/footer";
import { LandingHeader } from "@/features/landingpage/components/landing-header";
import { LandingPageBackground } from "@/features/landingpage/components/landing-page-background";
import { LandingPageGradients } from "@/features/landingpage/components/landing-page-gradients";

/**
 * Layout wrapper that renders the landing page chrome and hosts page content.
 *
 * Renders background, the landing header, the provided `children`, and the footer in a stacked layout.
 *
 * @param children - React nodes to be displayed as the main content of the landing page
 * @param params - Route params carrying the `[locale]` segment, forwarded to the footer translations.
 * @returns The composed landing page JSX element
 */
export default async function LandingPageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return (
    <div className="relative min-h-screen">
      <LandingPageGradients />
      <LandingPageBackground />
      <div className="relative z-10">
        <LandingHeader />
        {children}
        <FooterSection locale={locale} />
      </div>
    </div>
  );
}
