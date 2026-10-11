import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function CardSkeleton({
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

export function ClaimWorkspaceSkeleton() {
  return (
    <LoadingRegion label="Loading Claim workspace">
      <ClaimDocumentSkeleton review={false} />
    </LoadingRegion>
  );
}

export function ClaimReviewSkeleton() {
  return (
    <LoadingRegion label="Loading Claim review">
      <div className="flex flex-col gap-5">
        <Skeleton className="h-5 w-48" />
        <ClaimDocumentSkeleton review />
      </div>
    </LoadingRegion>
  );
}

function ClaimDocumentSkeleton({ review }: { review: boolean }) {
  return (
    <div className="min-w-0">
      <Card variant="claim-band">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-6 w-28" />
      </Card>
      <div className="min-w-0 border border-t-0 bg-card">
        <div className="grid min-w-0 min-[961px]:grid-cols-[minmax(0,1fr)_340px]">
          <aside className="min-w-0 border-b bg-muted min-[961px]:col-start-2 min-[961px]:row-start-1 min-[961px]:border-b-0 min-[961px]:border-l">
            <CardSkeleton variant="action" rows={4} />
          </aside>
          <div className="min-w-0 min-[961px]:col-start-1 min-[961px]:row-start-1">
            <CardSkeleton variant="document" rows={4} />
            {!review && <CardSkeleton variant="document" />}
            <CardSkeleton variant="document" />
            <CardSkeleton variant="document" rows={2} />
          </div>
        </div>
        <div className="flex flex-col gap-4 px-8 py-7 max-sm:px-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

export function ClaimReviewQueueSkeleton() {
  return (
    <LoadingRegion label="Loading submitted Claims">
      <CardSkeleton />
    </LoadingRegion>
  );
}

export function PartnershipParticipantsSkeleton() {
  return (
    <LoadingRegion label="Loading Project Participations">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-5 w-64 max-w-full" />
        <CardSkeleton rows={3} />
        <CardSkeleton rows={1} />
        <CardSkeleton rows={2} />
        <CardSkeleton rows={2} />
      </div>
    </LoadingRegion>
  );
}

export function ParticipantDetailsSkeleton() {
  return (
    <LoadingRegion label="Loading Participant details">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-64 max-w-full" />
        <CardSkeleton rows={2} />
        <CardSkeleton rows={1} />
      </div>
    </LoadingRegion>
  );
}

export function HostedParticipantsSkeleton() {
  return (
    <LoadingRegion label="Loading the Participants report">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-full" />
        <CardSkeleton rows={1} />
        <CardSkeleton rows={1} />
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
