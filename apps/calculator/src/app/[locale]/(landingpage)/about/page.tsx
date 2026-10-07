import { AboutFooter } from "@/features/landingpage/components/about/about-footer";
import { AboutHeader } from "@/features/landingpage/components/about/about-header";
import { PartnersSection } from "@/features/landingpage/components/about/partners-section";

/**
 * Renders the About page with localized content and a list of partner cards.
 *
 * This server-rendered React component displays the about header, partners section
 * with introduction and partner cards, and footer with Erasmus funding information.
 *
 * @returns The About page JSX element
 */
// ensureStatic = 'navigation': fully static marketing page (#246).
export const ensureStatic = "navigation";

export default async function AboutPage({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return (
    <main className="min-h-screen">
      <AboutHeader locale={locale} />
      <PartnersSection locale={locale} />
      <AboutFooter locale={locale} />
    </main>
  );
}
