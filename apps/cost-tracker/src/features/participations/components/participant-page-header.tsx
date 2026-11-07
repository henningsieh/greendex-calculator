import { getTranslations } from "@greendex/i18n/server";
import { ORPCError } from "@orpc/client";
import type { Route } from "next";

import ProtectedPageHeader from "@/components/protected-page-header";
import { orpcQuery } from "@/lib/orpc/orpc";
import { getQueryClient } from "@/lib/tanstack-react-query/hydration";

export async function ParticipantPageHeader({
  params,
}: {
  params: Promise<{ partnershipId: string; participationId?: string }>;
}) {
  const { partnershipId, participationId } = await params;
  const t = await getTranslations("participations.app");
  const client = getQueryClient();
  let authorized = false;
  let projectName: string | undefined;
  let participantName: string | undefined;
  try {
    if (participationId) {
      const data = await client.query(
        orpcQuery.participations.get.queryOptions({
          input: { partnershipId, id: participationId },
          meta: { costTrackerORPC: true },
        }),
      );
      authorized = Boolean(data);
      projectName = data?.projectName;
      participantName = data?.participation.displayName;
    } else {
      const data = await client.query(
        orpcQuery.participations.listPartnership.queryOptions({
          input: { partnershipId },
          meta: { costTrackerORPC: true },
        }),
      );
      projectName = data?.projectName;
    }
  } catch (error) {
    if (
      !(error instanceof ORPCError) ||
      !["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(error.code)
    )
      throw error;
  }
  return (
    <ProtectedPageHeader
      eyebrow={t("eyebrow")}
      title={
        participantName ??
        t(participationId ? "participantDetails" : "projectParticipations")
      }
      description={t(
        participationId
          ? "participantDetailsDescription"
          : "coordinateDescription",
      )}
      breadcrumbs={[
        { label: t("projects"), href: "/projects" },
        ...(projectName ? [{ label: projectName }] : []),
        ...(participationId && authorized
          ? [
              {
                label: t("projectParticipations"),
                href: `/partnerships/${encodeURIComponent(partnershipId)}/participants` as Route,
              },
            ]
          : []),
      ]}
    />
  );
}
