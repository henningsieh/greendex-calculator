import { Suspense } from "react";

import AuthFlowLayout from "@/features/authentication/components/auth-flow-layout";
import { AuthPageSkeleton } from "@/features/authentication/components/auth-page-skeleton";
import { ForgotPasswordForm } from "@/features/authentication/components/forgot-password-form";
import type { LocaleParams } from "@/lib/i18n/types";

interface ForgotPasswordPageProps {
  params: Promise<LocaleParams>;
}

/**
 * Renders the forgot-password page with a layout-shaped placeholder that
 * paints first while the localized layout streams in.
 */
export default function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <LocalizedForgotPassword params={params} />
    </Suspense>
  );
}

async function LocalizedForgotPassword({ params }: ForgotPasswordPageProps) {
  const { locale } = await params;

  return (
    <AuthFlowLayout locale={locale}>
      <ForgotPasswordForm />
    </AuthFlowLayout>
  );
}
