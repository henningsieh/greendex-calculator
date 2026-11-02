"use client";

import { useTranslations } from "@greendex/i18n/client";
import { SearchIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getProjectColumnFilters,
  isProjectPageSize,
  isProjectWindowFilter,
  PROJECT_FILTER_IDS,
  pushColumnFiltersToUrl,
  type ProjectListQueryState,
} from "@/features/projects/components/project-list-filtering";
import {
  PROJECT_PAGE_SIZES,
  PROJECT_SORT_MODES,
  PROJECT_WINDOW_FILTERS,
  type ProjectListState,
} from "@/features/projects/list-query-options";

/**
 * Filter controls above the Suspense boundary: search, selects, and date
 * inputs stay mounted (and keep focus) while the results below reload.
 * nuqs stays the source of truth; every control funnels through
 * pushColumnFiltersToUrl.
 */
export function ProjectListFilters({
  state,
  urlState,
  setUrlState,
}: {
  state: ProjectListState;
  urlState: ProjectListQueryState[0];
  setUrlState: ProjectListQueryState[1];
}) {
  const t = useTranslations("projects.list");
  const searchTimeout = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(searchTimeout.current), []);

  const columnFilters = getProjectColumnFilters(urlState);

  const updateProjectFilter = (
    id: (typeof PROJECT_FILTER_IDS)[keyof typeof PROJECT_FILTER_IDS],
    value: unknown,
  ) =>
    pushColumnFiltersToUrl(
      [...columnFilters.filter((filter) => filter.id !== id), { id, value }],
      state,
      urlState,
      setUrlState,
    );

  // Labels for the trigger: Base UI resolves the displayed label from the
  // `items` prop (docs pattern), not from the mounted item children.
  const sortItems = [
    { value: "operational", label: t("sortOpenEarliest") },
    { value: "start-asc", label: t("sortStartEarliest") },
    { value: "start-desc", label: t("sortStartLatest") },
    { value: "end-asc", label: t("sortEndEarliest") },
    { value: "end-desc", label: t("sortEndLatest") },
  ];
  const windowItems = PROJECT_WINDOW_FILTERS.map((value) => ({
    value,
    label: value === "all" ? t("allWindows") : value,
  }));
  const pageSizeItems = PROJECT_PAGE_SIZES.map((value) => ({
    value: String(value),
    label: String(value),
  }));

  return (
    <div className="grid gap-5 rounded-xl border p-5 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="project-search">{t("name")}</Label>
        <div className="relative">
          <SearchIcon
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            /* eslint-disable-next-line shadcn/no-restyle -- Search icon overlay requires matching input inset. */
            className="pl-9"
            defaultValue={urlState.search}
            id="project-search"
            data-testid="project-search"
            key={urlState.search}
            onChange={(event) => {
              const search = event.target.value;
              window.clearTimeout(searchTimeout.current);
              searchTimeout.current = window.setTimeout(() => {
                updateProjectFilter(PROJECT_FILTER_IDS.name, search);
              }, 300);
            }}
            placeholder={t("searchPlaceholder")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-submission-window">{t("submissionWindow")}</Label>
        <Select
          items={windowItems}
          onValueChange={(value) =>
            updateProjectFilter(
              PROJECT_FILTER_IDS.window,
              value && isProjectWindowFilter(value) ? value : state.window,
            )
          }
          value={state.window}
        >
          <SelectTrigger
            className="w-full"
            id="project-submission-window"
            data-testid="project-submission-window"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_WINDOW_FILTERS.map((value) => (
              <SelectItem key={value} value={value}>
                {value === "all" ? t("allWindows") : value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-sort">{t("sort")}</Label>
        <Select
          items={sortItems}
          onValueChange={(value) =>
            void setUrlState({
              cursor: null,
              sort:
                PROJECT_SORT_MODES.find((mode) => mode === value) ??
                "operational",
            })
          }
          value={state.sort}
        >
          <SelectTrigger
            className="w-full"
            id="project-sort"
            data-testid="project-sort"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="operational">{t("sortOpenEarliest")}</SelectItem>
            <SelectItem value="start-asc">{t("sortStartEarliest")}</SelectItem>
            <SelectItem value="start-desc">{t("sortStartLatest")}</SelectItem>
            <SelectItem value="end-asc">{t("sortEndEarliest")}</SelectItem>
            <SelectItem value="end-desc">{t("sortEndLatest")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-page-size">{t("perPage")}</Label>
        <Select
          items={pageSizeItems}
          onValueChange={(value) => {
            const pageSize = Number(value);
            void setUrlState({
              cursor: null,
              pageSize: isProjectPageSize(pageSize) ? pageSize : state.pageSize,
            });
          }}
          value={String(state.pageSize)}
        >
          <SelectTrigger
            className="w-full"
            id="project-page-size"
            data-testid="project-page-size"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_PAGE_SIZES.map((value) => (
              <SelectItem
                data-testid={`project-page-size-${value}`}
                key={value}
                value={String(value)}
              >
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-date-from">{t("activeAfter")}</Label>
        <Input
          id="project-date-from"
          data-testid="project-date-from"
          onChange={(event) =>
            updateProjectFilter(
              PROJECT_FILTER_IDS.dateFrom,
              event.target.value
                ? new Date(`${event.target.value}T00:00:00.000Z`)
                : null,
            )
          }
          type="date"
          value={state.dateFrom?.toISOString().slice(0, 10) ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-date-to">{t("activeBefore")}</Label>
        <Input
          id="project-date-to"
          data-testid="project-date-to"
          onChange={(event) =>
            updateProjectFilter(
              PROJECT_FILTER_IDS.dateTo,
              event.target.value
                ? new Date(`${event.target.value}T00:00:00.000Z`)
                : null,
            )
          }
          type="date"
          value={state.dateTo?.toISOString().slice(0, 10) ?? ""}
        />
      </div>
    </div>
  );
}
