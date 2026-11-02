"use client";

import { useTranslations } from "@greendex/i18n/client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProjectListQueryState } from "@/features/projects/components/project-list-filtering";
import type { ProjectListScopeAvailability } from "@/features/projects/list-query-options";

/**
 * Hosted / Partner scope tabs. Above the Suspense boundary on purpose:
 * switching scope only needs the stable availability plus URL state, so the
 * tabs never flash while the list below reloads.
 */
export function ProjectScopeTabs({
  scope,
  availableScopes,
  updateListState,
}: {
  scope: "hosted" | "partner";
  availableScopes: ProjectListScopeAvailability;
  updateListState: (patch: Parameters<ProjectListQueryState[1]>[0]) => void;
}) {
  const t = useTranslations("projects.list");
  return (
    <Tabs
      value={scope}
      onValueChange={(value) => {
        if (value === "hosted" || value === "partner")
          updateListState({ scope: value });
      }}
    >
      <TabsList aria-label={t("relationship")}>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className={
                  !availableScopes.hosted
                    ? "inline-flex cursor-not-allowed"
                    : "inline-flex"
                }
              />
            }
          >
            <TabsTrigger
              className="min-w-40"
              data-testid="project-scope-hosted"
              variant="brand"
              disabled={!availableScopes.hosted && availableScopes.partner}
              value="hosted"
            >
              {t("hosted")}
            </TabsTrigger>
          </TooltipTrigger>
          {!availableScopes.hosted && (
            <TooltipContent>{t("noHostedProjects")}</TooltipContent>
          )}
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className={
                  !availableScopes.partner
                    ? "inline-flex cursor-not-allowed"
                    : "inline-flex"
                }
              />
            }
          >
            <TabsTrigger
              className="min-w-40"
              data-testid="project-scope-partner"
              variant="brand"
              disabled={!availableScopes.partner}
              value="partner"
            >
              {t("partner")}
            </TabsTrigger>
          </TooltipTrigger>
          {!availableScopes.partner && (
            <TooltipContent>{t("noPartnerProjects")}</TooltipContent>
          )}
        </Tooltip>
      </TabsList>
    </Tabs>
  );
}
