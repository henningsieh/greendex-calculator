import { Skeleton } from "@/components/ui/skeleton";

/**
 * Deterministic placeholder approximating an auth form (title, fields,
 * submit button) while the search-param-driven form streams in.
 */
export function AuthFormSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-4"
      aria-hidden="true"
      data-testid="auth-form-skeleton"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
