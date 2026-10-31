import { getTranslations } from "@greendex/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { PartnershipParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";
import { PartnershipParticipantsSection } from "@/features/participations/components/partnership-participants-section";
import { hasOrganizationMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Project Participations" };

export default async function PartnershipParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  if (!(await hasOrganizationMembership())) return null;
  const t = await getTranslations("participations.app");

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link className={buttonVariants({ variant: "ghost" })} href="/projects">
          {t("backToProjects")}
        </Link>
        <h1 className="font-heading text-4xl font-semibold">
          {t("projectParticipations")}
        </h1>
        <p className="text-muted-foreground">{t("coordinateDescription")}</p>
      </header>
      <Suspense fallback={<PartnershipParticipantsSkeleton />}>
        <PartnershipParticipantsSection params={params} />
      </Suspense>
    </div>
  );
}
