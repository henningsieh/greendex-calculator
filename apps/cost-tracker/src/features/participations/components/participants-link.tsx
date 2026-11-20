import { cn } from "cn";
import { ArrowUpRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { projectParticipantsPath } from "@/app/paths";
import { EntityIcon } from "@/components/entity-icon";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/i18n/routing";

/**
 * Navigation, not an action: the Hosting Participant view behind a typographic
 * link with an arrow. The owning feature supplies its own label, so callers
 * never pass translated text and the wording cannot drift between surfaces.
 *
 * `density` replaces the Button size axis on purpose: the `link` variant pins
 * `h-auto min-h-9`, which clamps every smaller size to the same 36px. Density
 * resets `min-h-0` after the variant, so the heights actually differ.
 */
const densityVariants = {
  compact: "h-6 min-h-0 gap-1 px-1 text-xs",
  default: "h-8 min-h-0 gap-1.5 px-1.5 text-sm",
} as const;

export function ParticipantsLink({
  className,
  density = "default",
  projectId,
  testId = "hosted-participants",
}: {
  className?: string;
  density?: keyof typeof densityVariants;
  projectId: string;
  /** Stable hook for the calling surface; defaults to the workspace link. */
  testId?: string;
}) {
  const t = useTranslations("participations.link");

  return (
    <Link
      className={cn(
        buttonVariants({ variant: "link" }),
        "whitespace-nowrap",
        densityVariants[density],
        className,
      )}
      data-testid={testId}
      href={projectParticipantsPath(projectId)}
    >
      <EntityIcon
        aria-hidden="true"
        className="size-3.5 shrink-0"
        entity="participants"
      />
      {t("label")}
      <ArrowUpRightIcon aria-hidden="true" className="size-3.5 shrink-0" />
    </Link>
  );
}
