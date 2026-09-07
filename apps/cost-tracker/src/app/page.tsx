import { db } from "@greendex/database";
import { headers } from "next/headers";
import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <AuthForm />
      </main>
    );
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
  const partners = projects.flatMap((project) =>
    project.partnerOrganizations.map((partner) => partner.organization),
  );
  return (
    <main className="min-h-svh bg-muted/30">
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <Link className="font-heading text-xl font-semibold" href="/">
          Cost Tracker
        </Link>
        <SignOutButton />
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 p-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border bg-card p-4">
          <p className="font-medium">{session.user.name}</p>
          <p className="mb-4 text-sm text-muted-foreground">
            {session.user.email}
          </p>
          <nav className="flex flex-col gap-2 text-sm">
            <Link href="/">Overview</Link>
            <Link href="/projects">Projects</Link>
            <Link href="/partner-organizations">Partner Organizations</Link>
          </nav>
        </aside>
        <section className="flex flex-col gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Signed in session</p>
            <h1 className="font-heading text-3xl font-semibold">
              Welcome back, {session.user.name}
            </h1>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Active Projects</p>
              <p className="font-heading text-4xl font-semibold">
                {projects.length}
              </p>
            </article>
            <article className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">
                Partner Organizations
              </p>
              <p className="font-heading text-4xl font-semibold">
                {new Set(partners.map((partner) => partner.id)).size}
              </p>
            </article>
          </div>
          <article className="rounded-xl border bg-card p-5">
            <h2 className="font-heading text-xl font-semibold">Your Projects</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {projects.length ? (
                projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      className="font-medium hover:underline"
                      href="/projects"
                    >
                      {project.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {project.location}
                    </p>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">
                  No active Projects in the selected Organization.
                </li>
              )}
            </ul>
          </article>
        </section>
      </div>
    </main>
  );
}
