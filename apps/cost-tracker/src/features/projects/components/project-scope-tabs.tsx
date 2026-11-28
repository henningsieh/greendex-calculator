"use client";

import { useTranslations } from "@greendex/i18n/client";

import {
  SectionTabs,
  SectionTabsList,
  SectionTabsTrigger,
} from "@/components/section-tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProjectListScopeAvailability } from "@/features/projects/list-query-options";
import type { ProjectListQueryState } from "@/features/projects/types";

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
    <SectionTabs
      value={scope}
      onValueChange={(value) => {
        if (value === "hosted" || value === "partner")
          updateListState({ scope: value });
      }}
    >
      <SectionTabsList aria-label={t("relationship")}>
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
            <SectionTabsTrigger
              data-testid="project-scope-hosted"
              disabled={!availableScopes.hosted && availableScopes.partner}
              value="hosted"
            >
              {t("hosted")}
            </SectionTabsTrigger>
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
            <SectionTabsTrigger
              data-testid="project-scope-partner"
              disabled={!availableScopes.partner}
              value="partner"
            >
              {t("partner")}
            </SectionTabsTrigger>
          </TooltipTrigger>
          {!availableScopes.partner && (
            <TooltipContent>{t("noPartnerProjects")}</TooltipContent>
          )}
        </Tooltip>
      </SectionTabsList>
    </SectionTabs>
  );
}
