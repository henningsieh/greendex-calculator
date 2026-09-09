import { Skeleton } from "@/components/ui/skeleton";

function LoadingRegion({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <output aria-label={label} aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </output>
  );
}

function HeaderSkeleton() {
  return (
    <header className="max-w-2xl">
      <Skeleton className="h-4 w-28" data-testid="loading-skeleton" />
      <Skeleton
        className="mt-4 h-11 w-72 max-w-full"
        data-testid="loading-skeleton"
      />
      <div className="mt-5 flex flex-col gap-2">
        <Skeleton className="h-5 w-full" data-testid="loading-skeleton" />
        <Skeleton className="h-5 w-4/5" data-testid="loading-skeleton" />
      </div>
    </header>
  );
}

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
