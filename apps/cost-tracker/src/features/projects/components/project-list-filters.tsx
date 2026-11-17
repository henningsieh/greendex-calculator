"use client";

import { useTranslations } from "@greendex/i18n/client";
import { SearchIcon } from "lucide-react";
import { Suspense, useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProjectColumnFilters,
  isProjectPageSize,
  PROJECT_FILTER_IDS,
  pushColumnFiltersToUrl,
  type ProjectListQueryState,
} from "@/features/projects/components/project-list-filtering";
import { ProjectListPartnerFilter } from "@/features/projects/components/project-list-partner-filter";
import {
  PROJECT_ARCHIVE_FILTERS,
  PROJECT_PAGE_SIZES,
  PROJECT_SETTLEMENT_FILTERS,
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
      urlState,
      setUrlState,
    );

  // Labels for the trigger: Base UI resolves the displayed label from the
  // `items` prop (docs pattern), not from the mounted item children.
  const pageSizeItems = PROJECT_PAGE_SIZES.map((value) => ({
    value: String(value),
    label: String(value),
  }));

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="project-archive">{t("archiveFilter")}</Label>
          <Select
            items={PROJECT_ARCHIVE_FILTERS.map((value) => ({
              value,
              label: t(`archive.${value}`),
            }))}
            value={state.archive}
            onValueChange={(value) => {
              const archive = PROJECT_ARCHIVE_FILTERS.find(
                (item) => item === value,
              );
              if (archive) void setUrlState({ archive, cursor: null });
            }}
          >
            <SelectTrigger
              id="project-archive"
              data-testid="project-archive-filter"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PROJECT_ARCHIVE_FILTERS.map((value) => (
                  <SelectItem
                    key={value}
                    value={value}
                    data-testid={`project-archive-${value}`}
                  >
                    {t(`archive.${value}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="project-settlement">{t("settlementFilter")}</Label>
          <Select
            items={PROJECT_SETTLEMENT_FILTERS.map((value) => ({
              value,
              label: t(`settlement.${value}`),
            }))}
            value={state.settlement}
            onValueChange={(value) => {
              const settlement = PROJECT_SETTLEMENT_FILTERS.find(
                (item) => item === value,
              );
              if (settlement) void setUrlState({ settlement, cursor: null });
            }}
          >
            <SelectTrigger
              id="project-settlement"
              data-testid="project-settlement-filter"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PROJECT_SETTLEMENT_FILTERS.map((value) => (
                  <SelectItem
                    key={value}
                    value={value}
                    data-testid={`project-settlement-${value}`}
                  >
                    {t(`settlement.${value}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="order-first flex min-w-0 flex-col gap-2">
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
        <div className="flex min-w-0 flex-col gap-2">
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
              <SelectGroup>
                {PROJECT_PAGE_SIZES.map((value) => (
                  <SelectItem
                    data-testid={`project-page-size-${value}`}
                    key={value}
                    value={String(value)}
                  >
                    {value}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <details
        data-testid="project-advanced-filters"
        open={Boolean(
          state.dateFrom || state.dateTo || state.partnerOrganizationIds.length,
        )}
      >
        <summary className="w-fit cursor-pointer rounded-sm text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
          {t("dateRange")}
        </summary>
        <div className="mt-3 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {state.scope === "hosted" && (
            <Suspense
              fallback={<Skeleton className="h-16 w-full sm:col-span-2" />}
            >
              <ProjectListPartnerFilter state={state} setUrlState={setUrlState} />
            </Suspense>
          )}
          <div className="flex flex-col gap-2">
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
          <div className="flex flex-col gap-2">
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
      </details>
    </div>
  );
}
