"use client";

/* eslint-disable shadcn/no-restyle -- This dense review register owns sentence-case sorting controls and compact data-cell typography. */

import { useTranslations } from "@greendex/i18n/client";
import { useDateFormat } from "@greendex/i18n/datetime/client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useQueryStates } from "nuqs";
import { useState, useSyncExternalStore } from "react";

import { projectPath } from "@/app/paths";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClaimReviewQueueSkeleton } from "@/features/claims/components/claim-loading-states";
import { ClaimReviewLink } from "@/features/claims/components/claim-review-link";
import { ClaimStatusBadge } from "@/features/claims/components/claim-status-badge";
import {
  claimQueueParsers,
  getClaimQueueQueryOptions,
  normalizeClaimQueueState,
  type ClaimQueueQueryState,
  type ClaimQueueState,
} from "@/features/claims/queue-query-options";
import {
  CLAIM_QUEUE_PAGE_SIZES,
  CLAIM_QUEUE_SORTS,
  type ClaimQueuePageSize,
  type ClaimQueueSort,
} from "@/features/claims/queue-schemas";
import { useDebouncedSearchDraft } from "@/hooks/use-debounced-search-draft";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

type SortField = "submitted" | "project" | "partner";

const sortKeys: Record<ClaimQueueSort, string> = {
  "submitted-asc": "submittedAsc",
  "submitted-desc": "submittedDesc",
  "project-asc": "projectAsc",
  "project-desc": "projectDesc",
  "partner-asc": "partnerAsc",
  "partner-desc": "partnerDesc",
};

function sortField(sort: ClaimQueueSort): SortField {
  return sort.startsWith("submitted")
    ? "submitted"
    : sort.startsWith("project")
      ? "project"
      : "partner";
}

function sortDirection(sort: ClaimQueueSort) {
  return sort.endsWith("-desc") ? "desc" : "asc";
}

function nextSort(current: ClaimQueueSort, field: SortField): ClaimQueueSort {
  if (sortField(current) !== field) return `${field}-asc`;
  return `${field}-${sortDirection(current) === "asc" ? "desc" : "asc"}`;
}

function QueueMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function SortHeader({
  field,
  label,
  currentSort,
  disabled,
  onSort,
  testId,
}: {
  field: SortField;
  label: string;
  currentSort: ClaimQueueSort;
  disabled: boolean;
  onSort: (sort: ClaimQueueSort) => void;
  testId: string;
}) {
  const t = useTranslations("claims.queue");
  const active = sortField(currentSort) === field;
  const direction = active ? sortDirection(currentSort) : null;
  const Icon =
    direction === "asc"
      ? ArrowUpIcon
      : direction === "desc"
        ? ArrowDownIcon
        : ArrowUpDownIcon;
  return (
    <Button
      className="-ml-2 h-auto min-h-9 justify-start gap-1 px-2 text-xs font-medium tracking-normal whitespace-nowrap normal-case"
      aria-label={
        direction
          ? t("sortHeaderActive", {
              direction: t(`sortDirection.${direction}`),
              field: label,
            })
          : t("sortHeaderInactive", { field: label })
      }
      data-testid={testId}
      disabled={disabled}
      onClick={() => onSort(nextSort(currentSort, field))}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span className="whitespace-nowrap">{label}</span>
      <Icon aria-hidden="true" data-icon="inline-end" />
    </Button>
  );
}

function ClaimQueueFilters({
  partnerOptions,
  state,
  setUrlState,
  urlState,
}: {
  partnerOptions: { id: string; name: string }[];
  state: ClaimQueueState;
  setUrlState: ClaimQueueQueryState[1];
  urlState: ClaimQueueQueryState[0];
}) {
  const t = useTranslations("claims.queue");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const hiddenFilterCount = Number(Boolean(state.partnerOrganizationId));

  const { draft: searchDraft, onChange: updateSearch } = useDebouncedSearchDraft({
    urlSearch: urlState.search,
    push: (search) => void setUrlState({ cursor: null, search }),
  });

  const pageSizeItems = CLAIM_QUEUE_PAGE_SIZES.map((value) => ({
    value: String(value),
    label: String(value),
  }));

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="grid min-w-0 gap-3 md:grid-cols-2 @4xl/content:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-2 @4xl/content:col-span-2">
          <Label htmlFor="claim-queue-search">{t("searchLabel")}</Label>
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              /* eslint-disable-next-line shadcn/no-restyle -- Search icon overlay requires matching input inset. */
              className="pl-9"
              id="claim-queue-search"
              data-testid="claim-queue-search"
              onChange={(event) => updateSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              value={searchDraft}
            />
          </div>
        </div>
        <div className="max-md:block md:contents">
          <button
            aria-controls="claim-filter-more-body"
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
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                filtersOpen && "rotate-180",
              )}
            />
          </button>
          <div
            className="max-md:mt-3 max-md:hidden max-md:gap-3 max-md:data-[open=true]:grid md:contents"
            data-open={filtersOpen}
            id="claim-filter-more-body"
          >
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="claim-partner-filter">{t("partnerFilter")}</Label>
              <Select
                items={[
                  { value: "all", label: t("allPartners") },
                  ...partnerOptions.map((partner) => ({
                    value: partner.id,
                    label: partner.name,
                  })),
                ]}
                onValueChange={(value) =>
                  void setUrlState({
                    cursor: null,
                    partnerOrganizationId: value === "all" ? null : value,
                  })
                }
                value={state.partnerOrganizationId ?? "all"}
              >
                <SelectTrigger
                  className="w-full"
                  id="claim-partner-filter"
                  data-testid="claim-partner-filter"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">{t("allPartners")}</SelectItem>
                    {partnerOptions.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="claim-sort">{t("sortLabel")}</Label>
              <Select
                items={CLAIM_QUEUE_SORTS.map((value) => ({
                  value,
                  label: t(`sort.${sortKeys[value]}`),
                }))}
                onValueChange={(value) => {
                  const sort = CLAIM_QUEUE_SORTS.find((item) => item === value);
                  if (sort) void setUrlState({ cursor: null, sort });
                }}
                value={state.sort}
              >
                <SelectTrigger
                  className="w-full"
                  id="claim-sort"
                  data-testid="claim-sort"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CLAIM_QUEUE_SORTS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`sort.${sortKeys[value]}`)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="claim-page-size">{t("pageSize")}</Label>
              <Select
                items={pageSizeItems}
                onValueChange={(value) => {
                  const pageSize = Number(value);
                  if (
                    CLAIM_QUEUE_PAGE_SIZES.includes(
                      pageSize as ClaimQueuePageSize,
                    )
                  )
                    void setUrlState({
                      cursor: null,
                      pageSize: pageSize as ClaimQueuePageSize,
                    });
                }}
                value={String(state.pageSize)}
              >
                <SelectTrigger
                  className="w-full"
                  id="claim-page-size"
                  data-testid="claim-page-size"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CLAIM_QUEUE_PAGE_SIZES.map((value) => (
                      <SelectItem key={value} value={String(value)}>
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
    </div>
  );
}

export function ClaimReviewQueue() {
  const t = useTranslations("claims.queue");
  const dateFormat = useDateFormat();
  const [urlState, setUrlState] = useQueryStates(claimQueueParsers, {
    history: "push",
    shallow: true,
  });
  const state = normalizeClaimQueueState(urlState);
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const { data, dataUpdatedAt, isFetching, isPlaceholderData, refetch } =
    useQuery({
      ...getClaimQueueQueryOptions(state),
      placeholderData: keepPreviousData,
      refetchOnMount: "always",
      staleTime: 0,
    });
  if (!data) return <ClaimReviewQueueSkeleton />;
  const filtered = data.metrics.filtered;
  const whole = data.metrics.whole;
  const hasActiveFilters = Boolean(state.search || state.partnerOrganizationId);
  const hasNoMatches =
    hasActiveFilters && filtered.claimCount === 0 && whole.claimCount > 0;
  const emptyTitleKey = hasNoMatches ? "noMatchesTitle" : "emptyTitle";
  const claimLabel =
    filtered.claimCount === whole.claimCount
      ? t("metrics.claims")
      : t("metrics.claimsTotal", { count: whole.claimCount });

  const onSort = (sort: ClaimQueueSort) =>
    void setUrlState({ cursor: null, sort });

  const emptyState = (
    <Empty
      className="min-h-56 rounded-xl"
      data-testid="review-queue-empty"
      variant="outlined"
    >
      <EmptyMedia variant="icon">
        <ClipboardCheckIcon aria-hidden="true" className="size-7" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle data-message={emptyTitleKey}>
          {hasNoMatches ? t("noMatchesTitle") : t("emptyTitle")}
        </EmptyTitle>
        <EmptyDescription>
          {hasNoMatches ? t("noMatchesDescription") : t("emptyDescription")}
        </EmptyDescription>
      </EmptyHeader>
      {hasActiveFilters && (
        <Button
          data-testid="claim-queue-clear-filters"
          onClick={() =>
            void setUrlState({
              cursor: null,
              partnerOrganizationId: null,
              search: null,
            })
          }
          size="sm"
          type="button"
          variant="outline"
        >
          {t("clearFilters")}
        </Button>
      )}
    </Empty>
  );

  return (
    <section
      aria-label={t("label")}
      className="mt-6 flex min-w-0 flex-col gap-4"
      data-hydrated={isHydrated ? "true" : undefined}
      data-testid="review-queue"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 className="text-lg font-semibold">{t("sectionTitle")}</h2>
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          <QueueMetric label={claimLabel} value={filtered.claimCount} />
          <QueueMetric
            label={t("metrics.projects")}
            value={filtered.projectCount}
          />
          <QueueMetric
            label={t("metrics.partners")}
            value={filtered.partnerOrganizationCount}
          />
        </dl>
      </div>

      <ClaimQueueFilters
        partnerOptions={data.partnerOptions}
        setUrlState={setUrlState}
        state={state}
        urlState={urlState}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span aria-live="polite">
          {isFetching
            ? t("refreshing")
            : t("updatedAt", {
                time: dateFormat.format(dataUpdatedAt, "time.seconds"),
              })}
        </span>
        <Button
          aria-label={t("refresh")}
          disabled={isFetching}
          onClick={() => void refetch()}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCwIcon
            aria-hidden="true"
            className={isFetching ? "motion-safe:animate-spin" : undefined}
          />
          <span className="hidden @lg/content:inline">{t("refresh")}</span>
        </Button>
      </div>

      {data.rows.length === 0 ? (
        !isPlaceholderData && emptyState
      ) : (
        <>
          <div className="hidden @4xl/content:block">
            <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
              <Table aria-label={t("label")} className="table-fixed">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[18%] whitespace-nowrap">
                      <SortHeader
                        currentSort={state.sort}
                        disabled={!isHydrated}
                        field="project"
                        label={t("columns.project")}
                        onSort={onSort}
                        testId="sort-claim-project"
                      />
                    </TableHead>
                    <TableHead className="w-[20%] px-2 whitespace-nowrap">
                      <SortHeader
                        currentSort={state.sort}
                        disabled={!isHydrated}
                        field="partner"
                        label={t("columns.partner")}
                        onSort={onSort}
                        testId="sort-claim-partner"
                      />
                    </TableHead>
                    <TableHead className="w-[17%] px-2 tracking-normal whitespace-nowrap normal-case">
                      {t("columns.status")}
                    </TableHead>
                    <TableHead className="w-[13%] px-2 whitespace-nowrap">
                      <SortHeader
                        currentSort={state.sort}
                        disabled={!isHydrated}
                        field="submitted"
                        label={t("columns.submitted")}
                        onSort={onSort}
                        testId="sort-claim-submitted"
                      />
                    </TableHead>
                    {/* The fixed register gives this column less width than its
                        one-line label needs, so the header wraps instead of
                        overflowing the column. */}
                    <TableHead className="w-[14%] px-2 text-right tracking-normal whitespace-normal normal-case">
                      {t("columns.estimatedReimbursement")}
                    </TableHead>
                    <TableHead
                      className="w-[18%] px-2 text-right tracking-normal whitespace-nowrap normal-case"
                      data-testid="claim-column-header-claimReview"
                    >
                      {/* The link's label is the column's meaning, so the
                          header stays bare on screen; assistive tech still
                          gets the column name. */}
                      <span className="sr-only">{t("columns.claimReview")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow
                      data-claim-row={row.partnershipId}
                      key={row.partnershipId}
                    >
                      <TableCell className="min-w-0 px-2 text-xs">
                        <Link
                          className="block truncate font-medium link-prose"
                          href={projectPath(row.projectId)}
                          title={row.projectName}
                        >
                          {row.projectName}
                        </Link>
                      </TableCell>
                      <TableCell
                        className="min-w-0 truncate px-2 text-xs"
                        title={row.organizationName}
                      >
                        {row.organizationName}
                      </TableCell>
                      <TableCell className="px-2 text-xs">
                        <ClaimStatusBadge status="submitted" />
                      </TableCell>
                      <TableCell className="px-2 text-xs whitespace-nowrap tabular-nums">
                        {dateFormat.format(row.submittedAt, "date.medium")}
                      </TableCell>
                      <TableCell className="px-2 text-right text-xs whitespace-nowrap tabular-nums">
                        {`${row.reimbursementAmountEur} ${t("currencyEur")}`}
                      </TableCell>
                      <TableCell className="px-2 text-right text-xs">
                        <ClaimReviewLink
                          density="compact"
                          partnershipId={row.partnershipId}
                          testId={`review-claim-${row.partnershipId}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid gap-3 @4xl/content:hidden">
            {data.rows.map((row) => (
              <article
                className="rounded-xl border bg-card px-4 py-3.5"
                data-claim-row={row.partnershipId}
                key={row.partnershipId}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    className="min-w-0 font-medium wrap-anywhere link-prose"
                    href={projectPath(row.projectId)}
                  >
                    {row.projectName}
                  </Link>
                  <ClaimStatusBadge status="submitted" />
                </div>
                <dl className="mt-2 grid grid-cols-[minmax(5.5rem,0.7fr)_minmax(0,1.3fr)] items-baseline gap-x-4 gap-y-1 border-t pt-2">
                  <dt className="text-xs text-muted-foreground">
                    {t("columns.partner")}
                  </dt>
                  <dd className="min-w-0 text-right text-xs wrap-anywhere">
                    {row.organizationName}
                  </dd>
                  <dt className="text-xs text-muted-foreground">
                    {t("columns.submitted")}
                  </dt>
                  <dd className="text-right text-xs whitespace-nowrap tabular-nums">
                    {dateFormat.format(row.submittedAt, "date.medium")}
                  </dd>
                  <dt className="text-xs text-muted-foreground">
                    {t("columns.estimatedReimbursement")}
                  </dt>
                  <dd className="text-right text-xs whitespace-nowrap tabular-nums">
                    {`${row.reimbursementAmountEur} ${t("currencyEur")}`}
                  </dd>
                </dl>
                <div className="mt-2 border-t pt-2 text-right">
                  <ClaimReviewLink
                    partnershipId={row.partnershipId}
                    testId={`review-claim-${row.partnershipId}-card`}
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("showingCount", {
                shown: data.rows.length,
                total: filtered.claimCount,
              })}
            </p>
            <div className="flex gap-2">
              {data.previousCursor && (
                <Button
                  onClick={() =>
                    void setUrlState({ cursor: data.previousCursor })
                  }
                  data-testid="previous-claim-page"
                  type="button"
                  variant="outline"
                >
                  {t("previousPage")}
                </Button>
              )}
              <Button
                disabled={!data.nextCursor}
                onClick={() => void setUrlState({ cursor: data.nextCursor })}
                data-testid="next-claim-page"
                type="button"
                variant="outline"
              >
                {t("nextPage")}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
