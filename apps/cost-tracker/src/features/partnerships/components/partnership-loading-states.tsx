import {
  CardSkeleton,
  HeaderSkeleton,
  LoadingRegion,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export function PartnerOrganizationsSkeleton() {
  return (
    <LoadingRegion label="Loading Partner Organizations">
      <HeaderSkeleton />
      <div className="mt-10 grid gap-px rounded-2xl border p-px sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="flex flex-col gap-5 p-6" key={index}>
            <Skeleton className="size-10" data-testid="loading-skeleton" />
            <Skeleton className="h-6 w-44" data-testid="loading-skeleton" />
            <Skeleton className="h-4 w-full" data-testid="loading-skeleton" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function ProjectPartnershipsSkeleton() {
  return (
    <LoadingRegion label="Loading Project Partnerships">
      <div className="mt-10 flex flex-col gap-4">
        <Skeleton className="h-8 w-72 max-w-full" />
        <CardSkeleton rows={1} />
        <CardSkeleton rows={1} />
        <CardSkeleton rows={1} />
      </div>
    </LoadingRegion>
  );
}
