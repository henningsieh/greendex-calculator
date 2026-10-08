import { Suspense } from "react";

import AuthFlowLayout from "@/features/authentication/components/auth-flow-layout";
import { AuthFormSkeleton } from "@/features/authentication/components/auth-form-skeleton";
import { AuthPageSkeleton } from "@/features/authentication/components/auth-page-skeleton";
import { LoginForm } from "@/features/authentication/components/login-form";

interface LoginPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}

/**
 * Render the login page with a layout-shaped placeholder that paints first.
 *
 * Both the `[locale]` param and the `nextPageUrl` query parameter are
 * request-time data, so the localized layout streams in behind a Suspense
 * boundary and the form streams within it once the search params resolve.
 */
export default function LoginPage({ params, searchParams }: LoginPageProps) {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <LocalizedLogin params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function LocalizedLogin({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;

  return (
    <AuthFlowLayout locale={locale}>
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginFromSearchParams searchParams={searchParams} />
      </Suspense>
    </AuthFlowLayout>
  );
}

/**
 * Resolve the query parameters and render the login form, passing
 * `nextPageUrl` through unchanged for the form to choose its callback URL.
 * Query-parameter promise rejections propagate to the caller.
 */
async function LoginFromSearchParams({
  searchParams,
}: Pick<LoginPageProps, "searchParams">) {
  const nextPageUrl = (await searchParams).nextPageUrl;
  return <LoginForm nextPageUrl={nextPageUrl} />;
}
