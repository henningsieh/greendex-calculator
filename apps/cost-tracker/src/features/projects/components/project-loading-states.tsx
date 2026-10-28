import {
  CardSkeleton,
  HeaderSkeleton,
  LoadingRegion,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

function ListRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-10 flex flex-col border-y">
      {Array.from({ length: count }, (_, index) => (
        <div className="flex items-center justify-between gap-6 py-6" key={index}>
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-6 w-48" data-testid="loading-skeleton" />
            <Skeleton
              className="h-4 w-72 max-w-full"
              data-testid="loading-skeleton"
            />
          </div>
          <Skeleton className="h-5 w-32" data-testid="loading-skeleton" />
        </div>
      ))}
    </div>
  );
}

export function ProjectsSkeleton() {
  return (
    <LoadingRegion label="Loading Projects">
      <HeaderSkeleton />
      <ListRowsSkeleton />
    </LoadingRegion>
  );
}

/**
 * List-only fallback for the inner Suspense boundary on the Projects page.
 * The page shell already renders the real header, so only rows are sketched.
 */
export function ProjectListSkeleton() {
  return (
    <LoadingRegion label="Loading Project list">
      <ListRowsSkeleton />
    </LoadingRegion>
  );
}

export function ProjectWorkspaceSkeleton() {
  return (
    <LoadingRegion label="Loading Project workspace">
      <div className="flex flex-col gap-8">
        <HeaderSkeleton />
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton rows={1} />
          <CardSkeleton rows={1} />
        </div>
        <CardSkeleton />
      </div>
    </LoadingRegion>
  );
}
