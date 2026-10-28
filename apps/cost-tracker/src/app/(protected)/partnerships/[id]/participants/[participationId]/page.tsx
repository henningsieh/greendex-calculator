import { getTranslations } from "@greendex/i18n/server";
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
  const t = await getTranslations("participations.app");

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link className={buttonVariants({ variant: "ghost" })} href="/projects">
          {t("backToProjects")}
        </Link>
        <h1 className="font-heading text-4xl font-semibold">
          {t("participantDetails")}
        </h1>
        <p className="text-muted-foreground">
          {t("participantDetailsDescription")}
        </p>
      </header>
      <Suspense fallback={<ParticipantDetailsSkeleton />}>
        <ParticipantDetailsSection params={params} />
      </Suspense>
    </div>
  );
}
