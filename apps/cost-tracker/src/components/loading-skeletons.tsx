import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingRegion({
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

export function HeaderSkeleton() {
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

export function CardSkeleton({
  variant = "default",
  rows = 3,
}: {
  variant?: "default" | "document" | "action";
  rows?: number;
}) {
  return (
    <Card variant={variant}>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-6 w-48 max-w-full" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: rows }, (_, index) => (
          <div className="flex flex-col gap-2" key={index}>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Navigation fallback adds the header absent from an inner section fallback. */
export function ProjectDataPageSkeleton({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <HeaderSkeleton />
      {children}
    </div>
  );
}
