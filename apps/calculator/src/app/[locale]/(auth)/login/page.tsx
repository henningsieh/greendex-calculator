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
