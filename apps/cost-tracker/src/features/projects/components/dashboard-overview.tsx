"use client";

import { useSuspenseQueries } from "@tanstack/react-query";
import { Building2Icon, FolderKanbanIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { orpcQuery } from "@/lib/orpc/orpc";

export function DashboardOverview({ userName }: { userName: string }) {
  const [projectsQuery, partnersQuery] = useSuspenseQueries({
    queries: [
      orpcQuery.projects.list.queryOptions(),
      orpcQuery.partnerOrganizations.list.queryOptions(),
    ],
  });
  const projects = projectsQuery.data;
  const partners = partnersQuery.data;
  const firstName = userName.split(" ")[0] || userName;

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
          value={partners.length}
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

        {projects.length > 0 ? (
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
                  {project.partnerOrganizationCount}{" "}
                  {project.partnerOrganizationCount === 1
                    ? "Partner Organization"
                    : "Partner Organizations"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty className="border-b">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderKanbanIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>
                <h3>No active Projects yet</h3>
              </EmptyTitle>
              <EmptyDescription>
                Projects for your selected Organization will appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
