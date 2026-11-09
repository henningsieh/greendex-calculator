"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useSuspenseQuery } from "@tanstack/react-query";

import { projectParticipantsPath, projectPath } from "@/app/paths";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Link } from "@/lib/i18n/routing";
import { orpcQuery } from "@/lib/orpc/orpc";

/** Browse the same bounded, assignment-scoped results as the hosted search picker. */
export function AssignedProjectList() {
  const t = useTranslations("projects.assigned");
  const { data: projects } = useSuspenseQuery(
    orpcQuery.projects.searchHosted.queryOptions({
      input: { search: "" },
      meta: { costTrackerORPC: true },
    }),
  );

  return (
    <section
      aria-label={t("label")}
      className="mt-10 space-y-4"
      data-testid="assigned-projects"
    >
      <h2 className="text-2xl">{t("title")}</h2>
      {projects.length === 0 ? (
        <Empty data-testid="assigned-projects-empty">
          <EmptyHeader>
            <EmptyTitle>{t("empty")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => (
            <li className="flex flex-wrap items-center gap-3" key={project.id}>
              <Link
                className="font-medium link-prose"
                href={projectPath(project.id)}
              >
                {project.name}
              </Link>
              <Link
                className="text-sm link-prose"
                href={projectParticipantsPath(project.id)}
              >
                {t("viewParticipants")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
