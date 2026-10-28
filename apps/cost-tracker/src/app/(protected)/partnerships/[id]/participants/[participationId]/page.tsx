import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ParticipantDetailsSkeleton } from "@/features/participations/components/loading-skeletons";
import { ParticipantDetailsSection } from "@/features/participations/components/participant-details-section";
import { hasOrganizationMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Participant details" };

export default async function ParticipantDetailsPage({
  params,
}: {
  params: Promise<{ id: string; participationId: string }>;
}) {
  if (!(await hasOrganizationMembership())) return null;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link className={buttonVariants({ variant: "ghost" })} href="/projects">
          Back to Projects
        </Link>
        <h1 className="font-heading text-4xl font-semibold">
          Participant details
        </h1>
        <p className="text-muted-foreground">
          Read this Project Participation and correct the data you are permitted
          to correct.
        </p>
      </header>
      <Suspense fallback={<ParticipantDetailsSkeleton />}>
        <ParticipantDetailsSection params={params} />
      </Suspense>
    </div>
  );
}
