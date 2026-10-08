import { Skeleton } from "@/components/ui/skeleton";
import { AuthFormSkeleton } from "@/features/authentication/components/auth-form-skeleton";
import { LandingPageBackground } from "@/features/landingpage/components/landing-page-background";

/**
 * Deterministic placeholder approximating the auth flow layout (back link,
 * form card, brand card) while the locale-dependent layout streams in.
 */
export function AuthPageSkeleton() {
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
