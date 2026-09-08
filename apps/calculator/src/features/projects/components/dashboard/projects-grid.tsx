"use client";

import { useTranslations } from "@greendex/i18n/client";
import { ArrowUpDownIcon, ChevronDownIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ProjectCard } from "@/features/projects/components/project-card";
import type { ProjectType } from "@/features/projects/types";
import {
  DEFAULT_PROJECT_SORT,
  ProjectSortField,
} from "@/features/projects/types";
import { PROJECT_SORT_FIELDS } from "@/features/projects/types";
import {
  createProjectComparator,
  getColumnDisplayName,
} from "@/features/projects/utils";

interface ProjectsGridProps {
  projects: ProjectType[];
  sortBy?: ProjectSortField;
}

/**
 * Render a filterable, sortable grid of project cards.
 *
 * The grid includes a text filter, controls to toggle sort direction, and a dropdown to choose the sort field.
 *
 * @param projects - The list of projects to display and filter.
 * @param sortBy - Optional initial sort field; when omitted the default sort from configuration is used.
 * @returns The rendered grid of project cards; if no projects match the current filter, an empty state is rendered.
 */
export function ProjectsGrid({
  projects,
  sortBy: initialSortBy,
}: ProjectsGridProps) {
  const t = useTranslations("organization.projects");

  const [sortBy, setSortBy] = useState<ProjectSortField>(
    initialSortBy ?? DEFAULT_PROJECT_SORT.column,
  );
  const [sortDesc, setSortDesc] = useState<boolean>(
    DEFAULT_PROJECT_SORT.order === "desc",
  );
  const [filter, setFilter] = useState("");

  // Memoize sort options to avoid regeneration with translation lookups
  const sortOptions = useMemo(
    () =>
      PROJECT_SORT_FIELDS.map((field) => ({
        value: field,
        label: getColumnDisplayName(field, t),
      })),
    [t],
  );

  const comparator = useMemo(
    () => createProjectComparator(sortBy, sortDesc),
    [sortBy, sortDesc],
  );

  // Selection state for grid view
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
    new Set(),
  );

  // Memoize selection callback to prevent unnecessary child re-renders
  const toggleProjectSelection = useCallback((id: string, value: boolean) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const sortedProjects = useMemo(() => {
    const lowerFilter = filter.toLowerCase();
    const filtered = projects.filter((p) =>
      (p.name || "").toLowerCase().includes(lowerFilter),
    );

    return [...filtered].sort(comparator);
  }, [projects, comparator, filter]);

  return (
    <>
      <div className="my-auto flex h-14 items-center">
        <Input
          className="h-8 max-w-sm"
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("table.filter-projects")}
          value={filter}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={() => setSortDesc((s) => !s)}
            size="sm"
            variant="outline"
          >
            <ArrowUpDownIcon className={sortDesc ? "rotate-180" : ""} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="flex w-32 items-center justify-end"
                onClick={(e) => e.stopPropagation()}
                size="sm"
                variant="outline"
              >
                {t("sort-label")} <ChevronDownIcon className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="space-y-1">
              <DropdownMenuLabel>{t("sort-projects")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sortOptions.map((opt) => (
                <DropdownMenuItem
                  className={sortBy === opt.value ? "bg-accent" : ""}
                  key={opt.value}
                  onClick={() => setSortBy(opt.value as ProjectSortField)}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedProjects.length > 0 ? (
          sortedProjects.map((project) => (
            <ProjectCard
              isSelected={selectedProjectIds.has(project.id)}
              key={project.id}
              onSelectChange={(value) =>
                toggleProjectSelection(project.id, value)
              }
              project={project}
            />
          ))
        ) : (
          <Empty className="col-span-full">
            <EmptyDescription>{t("no-projects-yet.title")}</EmptyDescription>
          </Empty>
        )}
      </div>
    </>
  );
}
