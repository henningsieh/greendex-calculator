import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import AuthFlowLayout from "@/features/authentication/components/auth-flow-layout";
import { AuthFormSkeleton } from "@/features/authentication/components/auth-form-skeleton";
import { LoginForm } from "@/features/authentication/components/login-form";
import { LandingPageBackground } from "@/features/landingpage/components/landing-page-background";

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
    <Suspense fallback={<LoginShellSkeleton />}>
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

function LoginShellSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="relative min-h-svh overflow-hidden bg-background"
    >
      <LandingPageBackground />

      <div className="relative mx-auto flex min-h-svh max-w-7xl flex-col gap-6 p-4 sm:px-6 sm:py-8 md:px-8">
        <div className="w-full max-w-7xl">
          <Skeleton className="h-9 w-36" />
        </div>

        <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
          <div className="mx-auto flex w-full max-w-xl flex-col rounded-xl border border-border/40 bg-card/60 p-6 backdrop-blur-xl lg:mx-0 lg:w-1/2 lg:max-w-none lg:p-8">
            <Skeleton className="h-6 w-28 rounded-full" />
            <div className="mt-6 flex-1">
              <AuthFormSkeleton />
            </div>
          </div>

          <div className="relative hidden w-full max-w-xl flex-col gap-6 rounded-xl border border-border/40 bg-card/30 p-6 backdrop-blur-xl lg:flex lg:w-1/2 lg:max-w-none lg:p-8">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="mt-auto grid grid-cols-2 gap-4">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
