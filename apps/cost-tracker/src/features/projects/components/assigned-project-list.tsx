"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";

import { orpcQuery } from "@/lib/orpc/orpc";

/** Browse the same bounded, assignment-scoped results as the hosted search picker. */
export function AssignedProjectList() {
  const { data: projects } = useSuspenseQuery(
    orpcQuery.projects.searchHosted.queryOptions({
      input: { search: "" },
      meta: { costTrackerORPC: true },
    }),
  );

  return (
    <section aria-label="Assigned Projects" className="mt-10 space-y-4">
      <h2 className="font-heading text-2xl font-semibold">Your Projects</h2>
      {projects.length === 0 ? (
        <p className="text-muted-foreground">No Projects assigned yet.</p>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => (
            <li className="flex flex-wrap items-center gap-3" key={project.id}>
              <Link
                className="font-medium underline-offset-4 hover:underline"
                href={`/projects/${encodeURIComponent(project.id)}`}
              >
                {project.name}
              </Link>
              <Link
                className="text-sm underline-offset-4 hover:underline"
                href={`/projects/${encodeURIComponent(project.id)}/participants`}
              >
                View Participants
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
