import { getTranslations } from "@greendex/i18n/server";
import Image from "next/image";

/**
 * About page footer with Erasmus funding note
 */
export async function AboutFooter({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "landingPage.about" });

  return (
    <div className="container mx-auto max-w-7xl px-4 pb-16 text-center">
      <p className="text-muted-foreground">{t("erasmusFunding")}</p>
      <Image
        alt="European Commission Logo"
        className="mx-auto mt-4"
        height={80}
        src="/eu-flag.svg"
        width={120}
      />
    </div>
  );
}
