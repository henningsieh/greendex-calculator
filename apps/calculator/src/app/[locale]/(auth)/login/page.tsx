import { Suspense } from "react";

import AuthFlowLayout from "@/features/authentication/components/auth-flow-layout";
import { AuthFormSkeleton } from "@/features/authentication/components/auth-form-skeleton";
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
 * Render the login page with a statically prerendered auth shell.
 *
 * The `nextPageUrl` query parameter is request-time data, so the form
 * streams in behind a Suspense boundary while the shell stays static.
 */
// ensureStatic = 'prefetch': the auth shell and per-link prefetches stay
// static; the search-param-driven form streams at navigation (#246).
export const ensureStatic = "prefetch";

export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps) {
  const { locale } = await params;

  return (
    <AuthFlowLayout locale={locale}>
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginFromSearchParams searchParams={searchParams} />
      </Suspense>
    </AuthFlowLayout>
  );
}

async function LoginFromSearchParams({
  searchParams,
}: Pick<LoginPageProps, "searchParams">) {
  const nextPageUrl = (await searchParams).nextPageUrl;
  return <LoginForm nextPageUrl={nextPageUrl} />;
}
