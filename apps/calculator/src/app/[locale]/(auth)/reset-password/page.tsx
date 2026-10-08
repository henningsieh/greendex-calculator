import { Suspense } from "react";

import { LOGIN_PATH } from "@/app/routes";
import AuthFlowLayout from "@/features/authentication/components/auth-flow-layout";
import { AuthFormSkeleton } from "@/features/authentication/components/auth-form-skeleton";
import { AuthPageSkeleton } from "@/features/authentication/components/auth-page-skeleton";
import { ResetPasswordForm } from "@/features/authentication/components/reset-password-form";
import { redirect } from "@/lib/i18n/routing";

interface ResetPasswordPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}

/**
 * Render the reset-password page with a layout-shaped placeholder that
 * paints first.
 *
 * Both the `[locale]` param and the `token` query parameter are
 * request-time data, so the localized layout streams in behind a Suspense
 * boundary and the form (including the missing-token redirect) streams
 * within it once the search params resolve.
 */
export default function ResetPasswordPage({
  params,
  searchParams,
}: ResetPasswordPageProps) {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <LocalizedReset params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function LocalizedReset({ params, searchParams }: ResetPasswordPageProps) {
  const { locale } = await params;

  return (
    <AuthFlowLayout locale={locale}>
      <Suspense fallback={<AuthFormSkeleton />}>
        <ResetFromSearchParams searchParams={searchParams} locale={locale} />
      </Suspense>
    </AuthFlowLayout>
  );
}

/**
 * Render the reset form for a nonempty string token from the query parameters.
 * Redirect to login in `locale` when the token is missing, empty, or an array.
 * Query-parameter promise rejections propagate to the caller.
 */
async function ResetFromSearchParams({
  searchParams,
  locale,
}: Pick<ResetPasswordPageProps, "searchParams"> & { locale: string }) {
  const params = await searchParams;
  const token = params.token;

  // If no token is provided, redirect to forgot password page
  if (!token || typeof token !== "string") {
    return redirect({
      href: LOGIN_PATH,
      locale,
    });
  }

  return <ResetPasswordForm token={token} />;
}
