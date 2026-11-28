import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import {
  partnershipParticipantsPath,
  projectParticipantsPath,
} from "@/app/paths";
import { ButtonLink } from "@/components/button-link";
import { EntityIcon } from "@/components/entity-icon";
import { viewTransitionType } from "@/lib/view-transitions";

/**
 * Both Project and Partnership views use the same destination label. The
 * look, density scale, and trailing arrow live in `ButtonLink`; this module
 * only adds the Participants entity icon and the destination.
 */
export function ParticipantsLink({
  className,
  density = "default",
  projectId,
  partnershipId,
  describedBy,
  testId = projectId === undefined
    ? "coordinate-participants"
    : "hosted-participants",
}: {
  className?: string;
  density?: ComponentProps<typeof ButtonLink>["density"];
  describedBy?: string;
  /** Stable hook for the calling surface; defaults to the workspace link. */
  testId?: string;
} & (
  | { projectId: string; partnershipId?: never }
  | { partnershipId: string; projectId?: never }
)) {
  const t = useTranslations("participations.link");

  return (
    <ButtonLink
      className={className}
      density={density}
      describedBy={describedBy}
      href={
        projectId === undefined
          ? partnershipParticipantsPath(partnershipId)
          : projectParticipantsPath(projectId)
      }
      icon={<EntityIcon className="size-3.5 shrink-0" entity="participants" />}
      testId={testId}
      transitionTypes={[viewTransitionType.forward]}
    >
      {t("label")}
    </ButtonLink>
  );
}
