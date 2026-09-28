import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PrefetchedSectionSkeleton } from "@/components/prefetched-page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { PartnershipParticipantsSection } from "@/features/projects/components/partnership-participants-section";
import { hasOrganizationMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Partnership Participants" };

export default async function PartnershipParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await hasOrganizationMembership())) return null;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link className={buttonVariants({ variant: "ghost" })} href="/projects">
          Back to Projects
        </Link>
        <h1 className="font-heading text-4xl font-semibold">
          Partnership Participants
        </h1>
        <p className="text-muted-foreground">
          Coordinate Participants for this Project Partnership.
        </p>
      </header>
      <Suspense
        fallback={
          <PrefetchedSectionSkeleton label="Loading Partnership Participants" />
        }
      >
        <PartnershipParticipantsSection params={params} />
      </Suspense>
    </div>
  );
}
