import { CardSkeleton, LoadingRegion } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

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
