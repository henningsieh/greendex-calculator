import { db } from "@greendex/database";
import { Building2Icon, FolderKanbanIcon } from "lucide-react";
import type { Metadata } from "next";

import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Partner Organizations" };

export default async function PartnerOrganizationsPage() {
  const session = await requireSession();
  const activeOrganizationId = session.session.activeOrganizationId;
  const projects = activeOrganizationId
    ? await db.query.projectsTable.findMany({
        where: (project, { and, eq }) =>
          and(
            eq(project.organizationId, activeOrganizationId),
            eq(project.archived, false),
          ),
        columns: { id: true, name: true },
        with: { partnerOrganizations: { with: { organization: true } } },
      })
    : [];

  const partnerOrganizations = new Map<
    string,
    { id: string; name: string; projects: string[] }
  >();

  for (const project of projects) {
    for (const partnership of project.partnerOrganizations) {
      const existing = partnerOrganizations.get(partnership.organization.id);

      if (existing) {
        existing.projects.push(project.name);
      } else {
        partnerOrganizations.set(partnership.organization.id, {
          id: partnership.organization.id,
          name: partnership.organization.name,
          projects: [project.name],
        });
      }
    }
  }

  const partners = [...partnerOrganizations.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div>
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Project network</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Partner Organizations
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Organizations assigned to your active Projects through Project
          Partnerships.
        </p>
      </header>

      {partners.length ? (
        <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
          {partners.map((partner) => (
            <li className="bg-card p-6" key={partner.id}>
              <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Building2Icon aria-hidden="true" className="size-4" />
              </span>
              <h2 className="mt-7 font-heading text-xl font-semibold">
                {partner.name}
              </h2>
              <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                <FolderKanbanIcon
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0"
                />
                {partner.projects.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-10 border-y py-12">
          <h2 className="font-heading text-xl font-semibold">
            No Partner Organizations
          </h2>
          <p className="mt-2 text-muted-foreground">
            Project-specific Partner Organizations will appear here.
          </p>
        </section>
      )}
    </div>
  );
}
