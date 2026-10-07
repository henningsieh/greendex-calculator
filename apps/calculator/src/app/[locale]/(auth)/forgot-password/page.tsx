import AuthFlowLayout from "@/features/authentication/components/auth-flow-layout";
import { ForgotPasswordForm } from "@/features/authentication/components/forgot-password-form";

interface ForgotPasswordPageProps {
  params: Promise<{
    locale: string;
  }>;
}

/**
 * Renders the forgot-password page inside the authentication flow layout.
 *
 * Fully static: no request-time reads.
 */
// ensureStatic = 'navigation': fully static page (#246).
export const ensureStatic = "navigation";

export default async function ForgotPasswordPage({
  params,
}: ForgotPasswordPageProps) {
  const { locale } = await params;

  return (
    <AuthFlowLayout locale={locale}>
      <ForgotPasswordForm />
    </AuthFlowLayout>
  );
}
