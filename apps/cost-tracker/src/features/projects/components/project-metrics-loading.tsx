"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ProjectMetrics } from "@/features/projects/components/project-metrics";

/** Loading twin of `ProjectMetrics`: the same grid, three subgrid slots. */
export function ProjectMetricsLoading({
  columns = "three",
  label,
  testId,
}: {
  columns?: "two" | "three";
  label?: string;
  testId?: string;
}) {
  const slots = columns === "three" ? ["a", "b", "c"] : ["a", "b"];
  return (
    <ProjectMetrics
      aria-busy={true}
      aria-label={label}
      columns={columns}
      data-testid={testId}
    >
      {slots.map((slot) => (
        <div
          key={slot}
          className="row-span-3 grid min-w-0 grid-rows-subgrid p-3 sm:px-5"
        >
          <dt aria-hidden="true">
            <Skeleton
              className="h-5 w-24 max-w-full"
              data-testid="loading-skeleton"
            />
          </dt>
          <dd aria-hidden="true">
            <Skeleton className="mt-1 h-8 w-6" data-testid="loading-skeleton" />
          </dd>
          <dd aria-hidden="true">
            <Skeleton
              className="h-5 w-32 max-w-full"
              data-testid="loading-skeleton"
            />
          </dd>
        </div>
      ))}
    </ProjectMetrics>
  );
}
