import { getTranslations } from "@greendex/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { HostedParticipantsSection } from "@/features/participations/components/hosted-participants-section";
import { HostedParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";
import { hasOrganizationMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Participants report" };

export default async function HostedParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
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
          {t("reportTitle")}
        </h1>
        <p className="text-muted-foreground">{t("reportDescription")}</p>
      </header>
      <Suspense fallback={<HostedParticipantsSkeleton />}>
        <HostedParticipantsSection params={params} />
      </Suspense>
    </div>
  );
}
