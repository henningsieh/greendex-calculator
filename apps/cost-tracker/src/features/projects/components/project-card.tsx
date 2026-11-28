import { flexRender, type Row } from "@tanstack/react-table";
import { Fragment, type ReactNode } from "react";

import { projectPath } from "@/app/paths";
import type { AppHref } from "@/app/routes";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ParticipantsLink } from "@/features/participations/components/participants-link";
import type { projectListTableFeatures } from "@/features/projects/components/project-list-results";
import { ProjectStatusBadge } from "@/features/projects/components/project-status-badge";
import type { ProjectListRow } from "@/features/projects/types";
import { Link } from "@/lib/i18n/routing";
import { viewTransitionType } from "@/lib/view-transitions";

/**
 * One Project in the below-xl register grid.
 *
 * Built on the pre-designed Card (`ember` hover: lift + fire border + amber
 * wash). The title link stretches over the whole card so tapping anywhere
 * navigates to the Project, while the footer stays positioned above the
 * stretch so both remain clickable — no nested links. The footer wrapper
 * takes `mt-auto` so a stretched neighbour with a two-line name can't leave
 * this card's footer floating mid-card; the inner `mt-2` keeps the minimum
 * gap when there is no free space.
 */
export function ProjectCard({
  projectId,
  name,
  nameHref,
  nameTestId,
  status,
  details,
  footer,
}: {
  projectId: string;
  name: string;
  nameHref: AppHref;
  nameTestId: string;
  status?: ReactNode;
  details: { id: string; label: string; value: ReactNode; mono?: boolean }[];
  footer?: ReactNode;
}) {
  return (
    <Card
      variant="ember"
      // eslint-disable-next-line shadcn/no-restyle -- Dense register card: the sections own the compact rhythm, so the base stack padding is zeroed here.
      className="relative gap-0 px-0 pt-0 pb-3 focus-within:border-primary-border"
      data-project-id={projectId}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 pt-3.5">
        <Link
          className="block min-w-0 text-sm font-medium wrap-anywhere link-prose after:absolute after:inset-0 after:content-['']"
          data-testid={nameTestId}
          href={nameHref}
          transitionTypes={[viewTransitionType.forward]}
        >
          {name}
        </Link>
        {status}
      </CardHeader>
      <CardContent className="mt-2 px-4">
        <dl className="grid grid-cols-[minmax(5.5rem,0.7fr)_minmax(0,1.3fr)] items-baseline gap-x-4 gap-y-1 border-t border-border/60 pt-2">
          {details.map((detail) => (
            <Fragment key={detail.id}>
              <dt className="text-xs text-muted-foreground">{detail.label}</dt>
              <dd className="min-w-0 text-right text-xs wrap-anywhere">
                {detail.mono ? (
                  <span className="-mr-2 inline-block rounded-sm border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap tabular-nums">
                    {detail.value}
                  </span>
                ) : (
                  detail.value
                )}
              </dd>
            </Fragment>
          ))}
        </dl>
      </CardContent>
      {footer ? (
        <div className="mt-auto">
          <div className="mx-4 mt-2 border-t border-border/60 pt-1.5 text-right">
            {footer}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * Register adapter: turns one table row into a ProjectCard. Owns the table
 * plumbing — visible-cell split, status/details/footer mapping, test ids —
 * so the register grid stays a one-line map. The footer renders the compact
 * Participants link above the title link's stretch, exactly as before.
 */
export function ProjectRegisterCard({
  row,
  labels,
}: {
  row: Row<typeof projectListTableFeatures, ProjectListRow>;
  labels: Record<string, string>;
}) {
  const [titleCell, ...cellList] = row.getVisibleCells();
  if (!titleCell) return null;
  // Participants is navigation, not a data field: it leaves the
  // <dl> for the card footer, matching the submitted-Claim cards.
  // A hidden Participants column takes the footer with it.
  const detailCells = cellList.filter(
    (cell) => cell.column.id !== "participants" && cell.column.id !== "status",
  );
  const showStatus = cellList.some((cell) => cell.column.id === "status");
  const showParticipants = cellList.some(
    (cell) => cell.column.id === "participants",
  );
  return (
    <ProjectCard
      projectId={row.id}
      name={row.original.name}
      nameHref={projectPath(row.original.id)}
      nameTestId={`project-link-${row.original.id}-card`}
      status={
        showStatus ? (
          <ProjectStatusBadge status={row.original.status} compact />
        ) : undefined
      }
      details={detailCells.map((cell) => ({
        id: cell.id,
        label: labels[cell.column.id] ?? "",
        value: flexRender(cell.column.columnDef.cell, cell.getContext()),
        // Dates read as data: tabular mono digits in a muted chip.
        mono: cell.column.id === "startDate" || cell.column.id === "endDate",
      }))}
      footer={
        showParticipants ? (
          <ParticipantsLink
            density="compact"
            className="relative"
            projectId={row.original.id}
            testId={`project-participants-${row.original.id}-card`}
          />
        ) : undefined
      }
    />
  );
}
