import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PrefetchedSectionSkeleton } from "@/components/prefetched-page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { HostedParticipantsSection } from "@/features/projects/components/hosted-participants-section";
import { hasOrganizationMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Participants report" };

export default async function HostedParticipantsPage({
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
          Participants report
        </h1>
        <p className="text-muted-foreground">
          Read how onboarding is progressing across this Project, grouped by
          Partner Organization. This report only reads.
        </p>
      </header>
      <Suspense
        fallback={
          <PrefetchedSectionSkeleton label="Loading the Participants report" />
        }
      >
        <HostedParticipantsSection params={params} />
      </Suspense>
    </div>
  );
}