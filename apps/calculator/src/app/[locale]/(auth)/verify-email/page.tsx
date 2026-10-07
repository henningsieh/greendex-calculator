import { getTranslations, setRequestLocale } from "@greendex/i18n/server";

import { LOGIN_PATH } from "@/app/routes";
import AuthFlowLayout from "@/features/authentication/components/auth-flow-layout";
import { VerifyEmailContent } from "@/features/authentication/components/verify-email-content";

interface VerifyEmailPageProps {
  params: Promise<{
    locale: string;
  }>;
}

/**
 * Renders the verify-email page inside the authentication flow layout.
 *
 * Fully static: no request-time reads.
 *
 * @returns A React element containing an AuthFlowLayout configured with a localized back link and the VerifyEmailContent component.
 */
// ensureStatic = 'navigation': fully static page; the token is read
// client-side (#246).
export const ensureStatic = "navigation";

export default async function VerifyEmailPage({ params }: VerifyEmailPageProps) {
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
