import { db } from "@greendex/database";
import { Building2Icon, FolderKanbanIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";

import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
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
        with: { partnerOrganizations: { with: { organization: true } } },
      })
    : [];
  const partnerCount = new Set(
    projects.flatMap((project) =>
      project.partnerOrganizations.map((partner) => partner.organization.id),
    ),
  ).size;
  const firstName = session.user.name.split(" ")[0] || session.user.name;

  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Project overview</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Keep an eye on the Projects and Partner Organizations connected to your
          active Organization.
        </p>
      </header>

      <section
        aria-label="Organization summary"
        className="grid overflow-hidden rounded-2xl border bg-card sm:grid-cols-2"
      >
        <Summary
          icon={FolderKanbanIcon}
          label="Active Projects"
          value={projects.length}
        />
        <Summary
          icon={Building2Icon}
          label="Partner Organizations"
          value={partnerCount}
        />
      </section>

      <section>
        <div className="flex items-end justify-between gap-6 border-b pb-4">
          <div>
            <h2 className="font-heading text-2xl font-semibold">
              Upcoming Projects
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Active Projects ordered by start date.
            </p>
          </div>
          <Link
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            href="/projects"
          >
            View all
          </Link>
        </div>

        {projects.length ? (
          <ul className="divide-y">
            {projects.slice(0, 5).map((project) => (
              <li
                className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center"
                key={project.id}
              >
                <div>
                  <Link
                    className="font-heading text-lg font-semibold hover:underline"
                    href="/projects"
                  >
                    {project.name}
                  </Link>
                  <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPinIcon aria-hidden="true" className="size-4" />
                    {project.location}
                  </p>
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
          <div className="py-12">
            <p className="font-medium">No active Projects yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Projects for your selected Organization will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

type SummaryProps = {
  icon: typeof FolderKanbanIcon;
  label: string;
  value: number;
};

function Summary({ icon: Icon, label, value }: SummaryProps) {
  return (
    <article className="flex items-center gap-5 p-6 sm:p-8 sm:[&+&]:border-l">
      <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div>
        <p className="font-heading text-3xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </article>
  );
}
