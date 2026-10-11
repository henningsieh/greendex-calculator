import {
  PartnershipParticipantsSkeleton,
  ProjectDataPageSkeleton,
} from "@/features/projects/components/project-loading-states";

export default function Loading() {
  return (
    <ProjectDataPageSkeleton>
      <PartnershipParticipantsSkeleton />
    </ProjectDataPageSkeleton>
  );
}
