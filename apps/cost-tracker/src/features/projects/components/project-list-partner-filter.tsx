"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronDownIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import type { ProjectListQueryState } from "@/features/projects/components/project-list-filtering";
import {
  getProjectListQueryOptions,
  type ProjectListState,
} from "@/features/projects/list-query-options";

export function ProjectListPartnerFilter({
  state,
  setUrlState,
}: {
  state: ProjectListState;
  setUrlState: ProjectListQueryState[1];
}) {
  const t = useTranslations("projects.list");
  // This boundary may hydrate after the list. Enable the trigger only once
  // its own handlers are mounted, rather than relying on the list's signal.
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  // Options belong to the whole authorized scope. Keep their query stable
  // while selecting partners or paging so the open multi-select stays mounted.
  const { data } = useSuspenseQuery(
    getProjectListQueryOptions("hosted", {
      ...state,
      partnerOrganizationIds: [],
      cursor: undefined,
    }),
  );

  if (data.partnerOptions.length === 0) return null;

  return (
    <div
      className="flex min-w-0 flex-col gap-2"
      data-testid="project-partner-filter"
    >
      <Label htmlFor="project-partner-filter-trigger">
        {t("partnerOrganizations")}
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={!isHydrated}
          render={
            <button
              id="project-partner-filter-trigger"
              type="button"
              data-testid="project-partner-filter-menu"
              className="flex h-10 w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-input bg-input/30 px-3 py-2 text-base font-normal whitespace-nowrap transition-[color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0"
            />
          }
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {t("selectPartners")}
          </span>
          {state.partnerOrganizationIds.length > 0 && (
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {state.partnerOrganizationIds.length}
            </span>
          )}
          <ChevronDownIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            {data.partnerOptions.map((partner) => (
              <DropdownMenuCheckboxItem
                key={partner.id}
                data-testid={`project-partner-filter-${partner.id}`}
                checked={state.partnerOrganizationIds.includes(partner.id)}
                closeOnClick={false}
                onCheckedChange={(checked) =>
                  void setUrlState({
                    cursor: null,
                    partnerOrganizationIds: checked
                      ? [...state.partnerOrganizationIds, partner.id]
                      : state.partnerOrganizationIds.filter(
                          (id) => id !== partner.id,
                        ),
                  })
                }
              >
                {partner.name}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuItem
              data-testid="project-partner-filter-reset"
              onClick={() =>
                void setUrlState({ cursor: null, partnerOrganizationIds: [] })
              }
            >
              {t("clearPartners")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
