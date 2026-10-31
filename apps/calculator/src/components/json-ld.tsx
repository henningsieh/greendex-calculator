import {
  APP_NAME,
  BASE_URL,
  DESCRIPTION,
  LOGO_PATH,
} from "@greendex/config/metadata";

// JSON-LD structured data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}#website`,
      url: BASE_URL,
      name: APP_NAME,
      description: DESCRIPTION,
      inLanguage: ["en", "de"],
    },
    {
      "@type": "Organization",
      "@id": `${BASE_URL}#organization`,
      name: "Greendex",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}${LOGO_PATH}`,
      },
      description: DESCRIPTION,
      sameAs: [],
    },
    {
      "@type": "WebApplication",
      "@id": `${BASE_URL}#webapp`,
      name: APP_NAME,
      description: DESCRIPTION,
      applicationCategory: "EnvironmentalApplication",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
      },
    },
  ],
};

/**
 * JSON-LD structured data component for SEO
 * Renders schema.org structured data in a script tag
 */
export function JsonLd() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd),
      }}
      id="json-ld"
      type="application/ld+json"
    />
  );
}
