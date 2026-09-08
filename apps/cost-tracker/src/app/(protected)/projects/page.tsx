import { db } from "@greendex/database";
import { CalendarDaysIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";

import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Projects" };

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function ProjectsPage() {
  const session = await requireSession();
  const activeOrganizationId = session.session.activeOrganizationId;
  const projects = activeOrganizationId
    ? await db.query.projectsTable.findMany({
        where: (project, { and, eq }) =>
          and(
            eq(project.organizationId, activeOrganizationId),
            eq(project.archived, false),
          ),
        orderBy: (project, { asc }) => [asc(project.startDate)],
        with: { partnerOrganizations: true },
      })
    : [];

  return (
    <div>
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Workspace</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Projects
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          The active Projects whose travel costs belong to your selected
          Organization.
        </p>
      </header>

      {projects.length ? (
        <ul className="mt-10 divide-y border-y">
          {projects.map((project) => (
            <li
              className="grid gap-5 py-6 md:grid-cols-[1fr_auto] md:items-center"
              key={project.id}
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-heading text-xl font-semibold">
                    {project.name}
                  </h2>
                  <span
                    className={
                      project.costSubmissionWindowOpen
                        ? "text-sm font-medium text-primary"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    Cost window{" "}
                    {project.costSubmissionWindowOpen ? "open" : "closed"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <MapPinIcon aria-hidden="true" className="size-4" />
                    {project.location}
                  </span>
                  <span className="flex items-center gap-2">
                    <CalendarDaysIcon aria-hidden="true" className="size-4" />
                    {dateFormatter.format(project.startDate)}–
                    {dateFormatter.format(project.endDate)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {project.partnerOrganizations.length}{" "}
                {project.partnerOrganizations.length === 1
                  ? "Partner Organization"
                  : "Partner Organizations"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-10 border-y py-12">
          <h2 className="font-heading text-xl font-semibold">
            No active Projects
          </h2>
          <p className="mt-2 text-muted-foreground">
            Projects for the selected Organization will appear here.
          </p>
        </section>
      )}
    </div>
  );
}
