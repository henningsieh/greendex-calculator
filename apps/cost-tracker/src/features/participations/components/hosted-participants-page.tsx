import { getTranslations } from "@greendex/i18n/server";
import { ORPCError } from "@orpc/client";
import type { Route } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { HostedParticipantsSection } from "@/features/participations/components/hosted-participants-section";
import { HostedParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";
import { orpcQuery } from "@/lib/orpc/orpc";
import { getQueryClient } from "@/lib/tanstack-react-query/hydration";

async function ProjectBreadcrumb({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("participations.app");
  const project = await getQueryClient()
    .query(
      orpcQuery.projects.get.queryOptions({
        input: { projectId: id },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch((error: unknown) => {
      if (
        !(error instanceof ORPCError) ||
        !["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(error.code)
      )
        throw error;
      return null;
    });
  return (
    <ProtectedPageHeader
      eyebrow={t("eyebrow")}
      title={t("reportTitle")}
      description={t("reportDescription")}
      breadcrumbs={[
        { label: t("projects"), href: "/projects" },
        ...(project
          ? [
              {
                label: project.name,
                href: `/projects/${encodeURIComponent(id)}` as Route,
              },
            ]
          : []),
      ]}
    />
  );
}

export default async function HostedParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const t = await getTranslations("participations.app");

  return (
    <div className="space-y-8">
      <Suspense
        fallback={
          <ProtectedPageHeader
            eyebrow={t("eyebrow")}
            title={t("reportTitle")}
            description={t("reportDescription")}
          />
        }
      >
        <ProjectBreadcrumb params={params} />
      </Suspense>
      <Suspense fallback={<HostedParticipantsSkeleton />}>
        <HostedParticipantsSection params={params} />
      </Suspense>
    </div>
  );
}
