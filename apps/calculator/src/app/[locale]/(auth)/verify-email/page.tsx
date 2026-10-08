import { getTranslations, setRequestLocale } from "@greendex/i18n/server";
import { Suspense } from "react";

import { LOGIN_PATH } from "@/app/routes";
import AuthFlowLayout from "@/features/authentication/components/auth-flow-layout";
import { AuthPageSkeleton } from "@/features/authentication/components/auth-page-skeleton";
import { VerifyEmailContent } from "@/features/authentication/components/verify-email-content";

interface VerifyEmailPageProps {
  params: Promise<{
    locale: string;
  }>;
}

/**
 * Renders the verify-email page with a layout-shaped placeholder that
 * paints first while the localized layout streams in.
 *
 * @returns A React element containing an AuthFlowLayout configured with a localized back link and the VerifyEmailContent component.
 */
export default function VerifyEmailPage({ params }: VerifyEmailPageProps) {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <LocalizedVerifyEmail params={params} />
    </Suspense>
  );
}

async function LocalizedVerifyEmail({ params }: VerifyEmailPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "authentication.common" });

  return (
    <AuthFlowLayout
      locale={locale}
      backHref={LOGIN_PATH}
      backLabel={t("backToLogin")}
    >
      <VerifyEmailContent />
    </AuthFlowLayout>
  );
}
