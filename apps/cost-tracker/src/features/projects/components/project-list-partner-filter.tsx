"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
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
  getProjectPartnerFilterQueryOptions,
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
  const { data } = useSuspenseQuery(getProjectPartnerFilterQueryOptions(state));

  if (data.partnerOptions.length === 0) return null;

  return (
    <div
      className="flex min-w-0 flex-col gap-2 sm:col-span-2"
      data-testid="project-partner-filter"
    >
      <Label htmlFor="project-partner-filter-trigger">
        {t("partnerOrganizations")}
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={!isHydrated}
          render={
            <Button
              id="project-partner-filter-trigger"
              type="button"
              variant="outline"
              data-testid="project-partner-filter-menu"
              aria-describedby="project-partner-filter-help"
            />
          }
        >
          {t("selectPartners")}
          {state.partnerOrganizationIds.length > 0 && (
            <span>{state.partnerOrganizationIds.length}</span>
          )}
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
      <p
        id="project-partner-filter-help"
        className="text-xs text-muted-foreground"
      >
        {t("partnerFilterHelp")}
      </p>
    </div>
  );
}
