import { Skeleton } from "@/components/ui/skeleton";

/** Route-level fallback for server-prefetched protected workspaces. */
export function PrefetchedPageSkeleton({ label }: { label: string }) {
  return (
    <output aria-label={label} aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-5">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </output>
  );
}

/** Inner Suspense fallback when the real page header already rendered. */
export function PrefetchedSectionSkeleton({ label }: { label: string }) {
  return (
    <output aria-label={label} aria-live="polite" className="mt-10 block">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-48 w-full" />
    </output>
  );
}
