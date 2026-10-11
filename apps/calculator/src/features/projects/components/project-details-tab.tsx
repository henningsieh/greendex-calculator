import { useFormatter, useTranslations } from "@greendex/i18n/client";
import { Calendar1Icon, CalendarXIcon, MessageSquareIcon } from "lucide-react";

import { Blockquote, BlockquoteAuthor } from "@/components/block-quote";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PROJECT_ICONS } from "@/features/projects/components/project-icons";
import type { ProjectWithRelationsType } from "@/features/projects/types";

interface ProjectDetailsProps {
  project: ProjectWithRelationsType;
}

/**
 * Render a card showing key details for a project.
 *
 * @param project - The project object whose details will be displayed
 * @returns A card element containing the project's start and end dates, country, optional location, and optional welcome message
 */
export function ProjectDetailsTab({ project }: ProjectDetailsProps) {
  const t = useTranslations("project.details");
  const format = useFormatter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PROJECT_ICONS.project className="size-5 text-secondary" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              <Calendar1Icon className="mr-1 inline size-4" />
              {t("start-date")}
            </p>
            <p className="font-mono text-base font-semibold">
              {format.dateTime(project.startDate, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              <CalendarXIcon className="mr-1 inline size-4" />
              {t("end-date")}
            </p>
            <p className="font-mono text-base font-semibold">
              {format.dateTime(project.endDate, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              <PROJECT_ICONS.country className="mr-1 inline size-4" />
              {t("country")}
            </p>
            <p className="text-base font-semibold">{project.country}</p>
          </div>
          {project.location && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                <PROJECT_ICONS.location className="mr-1 inline size-4" />
                {t("location")}
              </p>
              <p className="text-base font-semibold">{project.location}</p>
            </div>
          )}
        </div>

        {project.welcomeMessage && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <MessageSquareIcon className="size-4 text-secondary" />
              <p className="text-sm font-medium">{t("welcome-message")}</p>
            </div>
            <Blockquote>
              {project.welcomeMessage}
              <BlockquoteAuthor className="text-sm font-normal">
                —{" "}
                {project.hostAssignments.map(({ user }) => user.name).join(", ")}
              </BlockquoteAuthor>
            </Blockquote>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
