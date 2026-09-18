/* eslint-disable shadcn/no-restyle -- This header intentionally owns its bespoke project presentation. */
"use client";

import { useLocale, useTranslations } from "@greendex/i18n/client";
import { LeafIcon } from "lucide-react";

import { Location } from "@/components/location";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Project } from "@/features/participate/types";
import { calculateProjectSharedTravelCO2 } from "@/features/project-shared-travel-legs/calculations";
import { PROJECT_ICONS } from "@/features/projects/components/project-icons";

interface ParticipateHeaderProps {
  project: Project;
}

/**
 * Render the participation header for a project, including its Project Shared
 * Travel contribution when present.
 *
 * @param project - Project to display; this component reads its canonical
 * `sharedTravelLegs` to compute and present the emissions contribution.
 * @returns The header JSX element containing the badge, title/subtitle, project
 * name, and a shared-travel contribution with a per-leg breakdown when present.
 */
export function ParticipateHeader({ project }: ParticipateHeaderProps) {
  const tSharedTravel = useTranslations("project.shared-travel");
  const t = useTranslations("participation.questionnaire");
  const locale = useLocale();
  const projectSharedTravelCO2 = calculateProjectSharedTravelCO2(
    project.sharedTravelLegs,
  );

  return (
    <div className="space-y-4 pb-4">
      {/* Sophisticated Header Bar */}
      <div className="flex items-center justify-between px-1 opacity-70 transition-opacity hover:opacity-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            Greendex
          </span>
          <span className="hidden h-[1em] w-px bg-border sm:block" />
          <span className="hidden text-sm text-muted-foreground sm:block">
            {t("header.subtitle")}
          </span>
        </div>
        <Badge
          className="gap-1.5 border-primary/40 bg-primary/20 px-2.5 text-[10px] font-semibold tracking-wider text-primary uppercase shadow-xs"
          variant="outline"
        >
          <LeafIcon className="size-3" />
          {t("header.badge")}
        </Badge>
      </div>

      <Card className="relative overflow-hidden border-border/50 bg-background/50 p-0 shadow-sm backdrop-blur-sm sm:bg-linear-to-r sm:from-background sm:to-muted/20">
        <div className="flex flex-col md:flex-row md:items-stretch">
          {/* Main Content: Project Title */}
          <div className="relative z-10 flex flex-1 flex-col justify-center p-5 md:p-6">
            <div className="mb-2 flex items-center gap-2">
              {project.location && (
                <Location
                  className="border-transparent bg-secondary/10 px-2.5 py-1.5 text-xs text-secondary/80 hover:bg-secondary/20"
                  countryCode={project.country}
                  locale={locale}
                  location={project.location}
                  showFlag
                  variant="badge"
                />
              )}
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              {project.name}
            </h1>
          </div>

          {/* Right Side: Project Shared Travel metrics */}
          <div className="flex flex-col border-t border-border/50 bg-muted/10 md:w-70 md:border-t-0 md:border-l lg:w-[320px]">
            {projectSharedTravelCO2 > 0 ? (
              <div className="flex flex-1 flex-col justify-center p-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="group flex w-full flex-col gap-2 rounded-md border border-border/40 bg-background/80 p-3 text-left shadow-xs transition-all hover:border-primary/20 hover:shadow-sm"
                      type="button"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-sm font-medium tracking-wide text-muted-foreground uppercase">
                          {t("project-shared-travel.title")}
                        </div>
                        <PROJECT_ICONS.sharedTravelLegs className="size-5 text-muted-foreground/50 transition-colors group-hover:text-primary/80" />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-2xl font-bold tracking-tight text-primary">
                          +{projectSharedTravelCO2.toFixed(1)}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">
                          kg CO₂
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60">
                        {t("project-shared-travel.note")}
                      </p>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="p-2" side="bottom">
                    <div className="max-w-xs">
                      <p className="mb-2 font-medium">{tSharedTravel("title")}</p>
                      <div className="space-y-1">
                        {project.sharedTravelLegs.map((sharedTravelLeg) => (
                          <div
                            className="flex justify-between text-sm"
                            key={sharedTravelLeg.id}
                          >
                            <span>
                              {tSharedTravel(
                                `types.${sharedTravelLeg.transportEmissionProfile}`,
                              )}
                            </span>
                            <span>{sharedTravelLeg.distanceKm} km</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-muted-foreground/50">
                <span className="text-sm">
                  {t("project-shared-travel.empty.title")}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
