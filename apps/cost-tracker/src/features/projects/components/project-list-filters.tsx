"use client";

import { useTranslations } from "@greendex/i18n/client";
import { ChevronDownIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { DatePicker } from "@/components/date-picker";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "@/features/projects/components/project-list-filtering";
import { ProjectListPartnerFilter } from "@/features/projects/components/project-list-partner-filter";
import {
  isDefaultProjectStatusSelection,
  PROJECT_PAGE_SIZES,
  PROJECT_STATUSES,
  type ProjectListState,
} from "@/features/projects/list-query-options";
import type { ProjectListQueryState } from "@/features/projects/types";
import { canonicalProjectStatuses } from "@/features/projects/validation-schemas";

/**
 * Filter controls render above the results Suspense boundary, so a result
 * refresh cannot suspend or remount them. nuqs stays the source of truth;
 * every control funnels through pushColumnFiltersToUrl.
 */
export function ProjectListFilters({
  onSearchChange,
  searchDraft,
  state,
  urlState,
  setUrlState,
}: {
  onSearchChange: (search: string) => void;
  searchDraft: string;
  state: ProjectListState;
  urlState: ProjectListQueryState[0];
  setUrlState: ProjectListQueryState[1];
}) {
  const t = useTranslations("projects.list");
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  const hiddenFilterCount = [
    !isDefaultProjectStatusSelection(state.status),
    Boolean(state.dateFrom),
    Boolean(state.dateTo),
    state.partnerOrganizationIds.length > 0,
  ].filter(Boolean).length;
  // "All" has exactly one representation: the complete selection.
  const hasEveryStatus = state.status.length === PROJECT_STATUSES.length;
  const statusSummary = hasEveryStatus
    ? t("statusAll")
    : state.status.map((status) => t(`status.${status}`)).join(", ");

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="grid min-w-0 gap-3 md:grid-cols-2 @4xl/content:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-2 @4xl/content:col-span-2">
          <Label htmlFor="project-search">{t("name")}</Label>
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              /* eslint-disable-next-line shadcn/no-restyle -- Search icon overlay requires matching input inset. */
              className="pl-9"
              value={searchDraft}
              id="project-search"
              data-testid="project-search"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("searchPlaceholder")}
            />
          </div>
        </div>
        <div className="max-md:block md:contents">
          <button
            aria-controls="project-filter-more-body"
            aria-expanded={filtersOpen}
            className="w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm font-medium max-md:flex md:hidden"
            onClick={() => setFiltersOpen((open) => !open)}
            type="button"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontalIcon aria-hidden="true" className="size-4" />
              {t("filters")}
              {hiddenFilterCount > 0 && (
                <span className="text-muted-foreground tabular-nums">
                  {hiddenFilterCount}
                </span>
              )}
            </span>
            <ChevronDownIcon
              aria-hidden="true"
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${filtersOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className="max-md:mt-3 max-md:hidden max-md:gap-3 max-md:data-[open=true]:grid md:contents"
            data-open={filtersOpen}
            id="project-filter-more-body"
          >
            <div className="flex min-w-0 flex-col gap-2 @4xl/content:col-span-2">
              <Label
                htmlFor="project-status-filter-trigger"
                id="project-status-filter-label"
              >
                {t("statusFilter")}
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      id="project-status-filter-trigger"
                      type="button"
                      aria-labelledby="project-status-filter-label"
                      data-testid="project-status-filter"
                      className="flex h-10 w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-input bg-input/30 px-3 py-2 text-base font-normal whitespace-nowrap transition-[color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0"
                    />
                  }
                >
                  <span className="min-w-0 flex-1 truncate text-left">
                    {statusSummary}
                  </span>
                  {hasEveryStatus ? null : (
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {state.status.length}
                    </span>
                  )}
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuGroup>
                    {PROJECT_STATUSES.map((status) => (
                      <DropdownMenuCheckboxItem
                        key={status}
                        data-testid={`project-status-${status}`}
                        checked={state.status.includes(status)}
                        closeOnClick={false}
                        onCheckedChange={(checked) => {
                          const nextStatus = checked
                            ? [...state.status, status]
                            : state.status.filter((value) => value !== status);
                          void setUrlState({
                            status: canonicalProjectStatuses(nextStatus),
                            cursor: null,
                          });
                        }}
                      >
                        {t(`status.${status}`)}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuItem
                      data-testid="project-status-all"
                      onClick={() =>
                        void setUrlState({
                          status: [...PROJECT_STATUSES],
                          cursor: null,
                        })
                      }
                    >
                      {t("statusAll")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="project-page-size">{t("perPage")}</Label>
              <Select
                items={pageSizeItems}
                onValueChange={(value) => {
                  const pageSize = Number(value);
                  void setUrlState({
                    cursor: null,
                    pageSize: isProjectPageSize(pageSize)
                      ? pageSize
                      : state.pageSize,
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
        <div className="mt-3 grid items-start gap-3 sm:grid-cols-2 @4xl/content:grid-cols-4">
          {state.scope === "hosted" && (
            <Suspense fallback={<Skeleton className="h-16 w-full" />}>
              <ProjectListPartnerFilter state={state} setUrlState={setUrlState} />
            </Suspense>
          )}
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 @4xl/content:col-span-2 @4xl/content:col-start-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-date-from">{t("activeAfter")}</Label>
              <DatePicker
                id="project-date-from"
                clearable
                data-testid="project-date-from"
                onChange={(date) =>
                  updateProjectFilter(PROJECT_FILTER_IDS.dateFrom, date ?? null)
                }
                value={state.dateFrom ?? undefined}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-date-to">{t("activeBefore")}</Label>
              <DatePicker
                id="project-date-to"
                clearable
                data-testid="project-date-to"
                onChange={(date) =>
                  updateProjectFilter(PROJECT_FILTER_IDS.dateTo, date ?? null)
                }
                value={state.dateTo ?? undefined}
              />
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
