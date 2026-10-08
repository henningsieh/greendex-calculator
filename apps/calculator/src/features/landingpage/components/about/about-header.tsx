import { getTranslations } from "@greendex/i18n/server";
import Image from "next/image";

/**
 * About page header with background image and title
 */
export async function AboutHeader({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "landingPage.about" });

  return (
    <div className="relative h-[50vh] min-h-125 w-full overflow-hidden">
      <Image
        alt="About Greendex"
        className="object-cover"
        fill
        priority
        src="/about-bg-header.jpg"
        style={{ objectPosition: "bottom" }}
      />
      <div className="absolute inset-0 bg-background/70" />
      <div className="relative z-10 container mx-auto flex h-full items-center justify-center">
        <h1
          className="text-center text-5xl font-bold text-foreground lg:text-7xl"
          data-testid="about-heading"
        >
          {t("aboutTitle")}
        </h1>
      </div>
    </div>
  );
}
