import { Suspense } from "react";

import AuthFlowLayout from "@/features/authentication/components/auth-flow-layout";
import { AuthFormSkeleton } from "@/features/authentication/components/auth-form-skeleton";
import { AuthPageSkeleton } from "@/features/authentication/components/auth-page-skeleton";
import { SignupForm } from "@/features/authentication/components/signup-form";

interface SignupPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}

/**
 * Render the signup page with a layout-shaped placeholder that paints first.
 *
 * Both the `[locale]` param and the `nextPageUrl` query parameter are
 * request-time data, so the localized layout streams in behind a Suspense
 * boundary and the form streams within it once the search params resolve.
 */
export default function SignupPage({ params, searchParams }: SignupPageProps) {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <LocalizedSignup params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function LocalizedSignup({ params, searchParams }: SignupPageProps) {
  const { locale } = await params;

  return (
    <AuthFlowLayout locale={locale}>
      <Suspense fallback={<AuthFormSkeleton />}>
        <SignupFromSearchParams searchParams={searchParams} />
      </Suspense>
    </AuthFlowLayout>
  );
}

/**
 * Resolve the query parameters and render the signup form, passing
 * `nextPageUrl` through unchanged for the form to choose its callback URL.
 * Query-parameter promise rejections propagate to the caller.
 */
async function SignupFromSearchParams({
  searchParams,
}: Pick<SignupPageProps, "searchParams">) {
  const nextPageUrl = (await searchParams).nextPageUrl;
  return <SignupForm nextPageUrl={nextPageUrl} />;
}
