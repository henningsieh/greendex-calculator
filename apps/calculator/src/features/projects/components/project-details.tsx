"use client";

import { useFormatter, useLocale, useTranslations } from "@greendex/i18n/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  ArchiveIcon,
  CalendarDaysIcon,
  Edit2Icon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { Location } from "@/components/location";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParticipantsLinkControls } from "@/features/participants/components/participants-link-controls";
import { ParticipantsList } from "@/features/participants/components/participants-list";
import { ProjectSharedTravelLegsTable } from "@/features/project-shared-travel-legs/components/project-shared-travel-legs-table";
import {
  EditProjectForm,
  EditProjectFormSkeleton,
} from "@/features/projects/components/edit-project-form";
import { ProjectDetailsTab } from "@/features/projects/components/project-details-tab";
import { PROJECT_ICONS } from "@/features/projects/components/project-icons";
import { getProjectStatistics } from "@/features/projects/utils";
import { useProjectPermissions } from "@/lib/better-auth/permissions-utils";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

interface ProjectDetailsProps {
  id: string;
}

/**
 * Server-rendered header component that displays project name, dates, location, and actions.
 * This is separated to allow SSR of the PageHeader while the rest loads in Suspense.
 *
 * @param id - Project identifier
 * @returns PageHeader component with project metadata and action dropdown
 */
export function ProjectDetailsHeader({ id }: ProjectDetailsProps) {
  const tProject = useTranslations("organization.projects");
  const {
    canUpdate,
    canDelete,
    canArchive,
    isPending: permissionsPending,
  } = useProjectPermissions();
  const format = useFormatter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: project } = useSuspenseQuery(
    orpcQuery.projects.getById.queryOptions({
      input: { id },
    }),
  );

  // Delete project mutation
  const { mutateAsync: deleteProjectMutation, isPending: isDeleting } =
    useMutation({
      mutationFn: () =>
        orpc.projects.delete({
          id: project.id,
        }),
      onSuccess: (result) => {
        if (result.success) {
          toast.success(tProject("form.delete.toast-success"));
          void queryClient.invalidateQueries({
            queryKey: orpcQuery.projects.list.queryKey(),
          });
        } else {
          toast.error(tProject("form.delete.toast-error"));
        }
      },
      onError: (err: unknown) => {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message || tProject("form.delete.toast-error-generic"));
      },
    });

  // Archive project mutation
  const { mutateAsync: archiveProjectMutation, isPending: isArchiving } =
    useMutation({
      mutationFn: (archived: boolean) =>
        orpc.projects.archive({
          id: project.id,
          archived,
        }),
      onSuccess: (result) => {
        if (result.success) {
          toast.success(
            result.project.archived
              ? tProject("form.archive.toast-success")
              : tProject("form.archive.toast-unarchive-success"),
          );
          void queryClient.invalidateQueries({
            queryKey: orpcQuery.projects.list.queryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: orpcQuery.projects.getById.queryKey({
              input: { id: project.id },
            }),
          });
        } else {
          toast.error(tProject("form.archive.toast-error"));
        }
      },
      onError: (err: unknown) => {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message || tProject("form.archive.toast-error-generic"));
      },
    });

  // Format project dates and location for description
  const description: React.ReactNode = (
    <div className="items-centergap-y-1 flex flex-wrap">
      <span>
        {format.dateTime(project.startDate, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
        {"\u00A0\u2013\u00A0"}
        {format.dateTime(project.endDate, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </span>
      <span className="text-muted-foreground">{"\u00A0\u007C\u00A0"}</span>

      <Location
        countryCode={project.country}
        locale={locale}
        location={project.location}
        showFlag
      />
    </div>
  );

  const action: React.ReactNode = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={tProject("form.edit.title")}
          size="icon"
          variant="secondaryoutline"
        >
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canUpdate && (
          <DropdownMenuItem
            disabled={permissionsPending}
            onSelect={() => setIsEditModalOpen(true)}
          >
            <Edit2Icon className="mr-2 size-4" />
            {tProject("table.edit-project")}
          </DropdownMenuItem>
        )}
        {canArchive && (
          <DropdownMenuItem
            disabled={isArchiving || permissionsPending}
            onSelect={async () => {
              const isCurrentlyArchived = project.archived ?? false;
              const confirmed = await confirm({
                title: isCurrentlyArchived
                  ? tProject("form.archive.unarchive-title")
                  : tProject("form.archive.confirm-title"),
                description: isCurrentlyArchived
                  ? tProject("form.archive.unarchive-description", {
                      name: project.name,
                    })
                  : tProject("form.archive.confirm-description", {
                      name: project.name,
                    }),
                confirmText: isCurrentlyArchived
                  ? tProject("form.archive.unarchive-button")
                  : tProject("form.archive.confirm-button"),
                cancelText: tProject("form.archive.cancel-button"),
                isDestructive: false,
              });
              if (confirmed) {
                try {
                  await archiveProjectMutation(!isCurrentlyArchived);
                } catch (err) {
                  console.error(err);
                }
              }
            }}
          >
            <ArchiveIcon className="mr-2 size-4" />
            {project.archived
              ? tProject("form.archive.unarchive")
              : tProject("form.archive.archive")}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isDeleting || permissionsPending}
              onSelect={async () => {
                const confirmed = await confirm({
                  title: tProject("form.delete.confirm-title"),
                  description: tProject("form.delete.confirm-description", {
                    name: project.name,
                  }),
                  confirmText: tProject("form.delete.confirm-button"),
                  cancelText: tProject("form.delete.cancel-button"),
                  isDestructive: true,
                });
                if (confirmed) {
                  try {
                    await deleteProjectMutation();
                  } catch (err) {
                    console.error(err);
                  }
                }
              }}
              variant="destructive"
            >
              <Trash2Icon className="mr-2 size-4" />
              {tProject("table.delete-project")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <PageHeader
        icon={<PROJECT_ICONS.project />}
        title={project.name}
        description={description}
        action={action}
      />

      {/* Edit Project Dialog */}
      {canUpdate && (
        <Dialog onOpenChange={setIsEditModalOpen} open={isEditModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tProject("form.edit.title")}</DialogTitle>
            </DialogHeader>
            <Suspense fallback={<EditProjectFormSkeleton />}>
              <EditProjectForm
                onSuccess={() => setIsEditModalOpen(false)}
                project={project}
              />
            </Suspense>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm Dialog Component */}
      <ConfirmDialogComponent />
    </>
  );
}

/**
 * Display a project's statistics, participation controls, and tabbed sections for details, Project Shared Travel, and Project Participants.
 *
 * @param id - Project identifier used to fetch project details, Project Participants, and Project Shared Travel Legs
 * @returns A React element containing the project's overview UI
 */
export function ProjectDetails({ id }: ProjectDetailsProps) {
  const t = useTranslations("project.details");
  const { canUpdate } = useProjectPermissions();

  // Fetch project details
  const { data: project } = useSuspenseQuery(
    orpcQuery.projects.getById.queryOptions({
      input: { id },
    }),
  );

  // Fetch participants
  const { data: participants } = useSuspenseQuery(
    orpcQuery.projects.getParticipants.queryOptions({
      input: { projectId: id },
    }),
  );

  // Fetch canonical Project Shared Travel Legs.
  const { data: sharedTravelLegs } = useSuspenseQuery(
    orpcQuery.projectSharedTravelLegs.list.queryOptions({
      input: { projectId: id },
    }),
  );

  // Calculate statistics (delegated to utility for consistency and testability)
  const {
    participantsCount,
    sharedTravelLegsCount,
    totalDistanceKm,
    durationDays,
    sharedTravelCO2Kg,
  } = getProjectStatistics(project, participants, sharedTravelLegs);

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Project Duration */}
        <Card className="gap-3">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-secondary">
              <CalendarDaysIcon className="size-4" />
              {t("statistics.duration")}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 font-mono text-2xl font-semibold text-foreground">
              {durationDays}
              <span className="text-sm font-normal text-muted-foreground">
                {t("statistics.days")}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Project Shared Travel Leg count and total distance */}
        <Card className="gap-3">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-secondary">
              <PROJECT_ICONS.sharedTravelLegs className="size-4" />
              {t("statistics.shared-travel-legs")}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 font-mono text-2xl font-semibold text-foreground">
              {sharedTravelLegsCount}
              <span className="text-sm font-normal text-muted-foreground">
                ({totalDistanceKm.toFixed(1)} {t("statistics.km")})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* CO2 emissions from project shared travel */}
        <Card className="gap-3">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-secondary">
              <PROJECT_ICONS.emissions className="size-4" />
              {t("statistics.co2-emissions")}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 font-mono text-2xl font-semibold text-foreground">
              {sharedTravelCO2Kg.toFixed(1)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                kg CO₂
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Participants Count */}
        <Card className="gap-3">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-secondary">
              <PROJECT_ICONS.participants className="size-4" />
              {t("statistics.participants")}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 font-mono text-2xl font-semibold text-foreground">
              {participantsCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Participation Link */}
      <ParticipantsLinkControls projectId={id} />

      {/* Tabs Navigation */}
      <Tabs className="gap-4" defaultValue="details">
        <TabsList
          className="grid w-full grid-cols-1 gap-2 p-0 sm:w-fit sm:grid-cols-3"
          variant="plain"
        >
          <TabsTrigger variant="secondary" value="details">
            <PROJECT_ICONS.project className="size-4" />
            {t("tabs.details")}
          </TabsTrigger>
          <TabsTrigger variant="secondary" value="shared-travel">
            <PROJECT_ICONS.sharedTravelLegs className="size-4" />
            {t("tabs.shared-travel")}
          </TabsTrigger>
          <TabsTrigger variant="secondary" value="participants">
            <PROJECT_ICONS.participants className="size-4" />
            {t("tabs.participants")}
          </TabsTrigger>
        </TabsList>

        {/* Project Details Tab */}
        <TabsContent className="flex flex-col gap-6" value="details">
          <ProjectDetailsTab project={project} />
        </TabsContent>

        <TabsContent value="shared-travel">
          <ProjectSharedTravelLegsTable canEdit={canUpdate} projectId={id} />
        </TabsContent>

        {/* Participants Tab */}
        <TabsContent value="participants">
          <ParticipantsList activeProjectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Renders a skeleton placeholder UI that mirrors the ProjectDetails layout.
 *
 * @returns A JSX element containing skeleton placeholders for the statistics grid, participation controls, tabs, and tab content used while project data is loading.
 */
export function ProjectDetailsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Statistics Cards Skeleton */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
            key={i}
          >
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Participation Link Skeleton */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs Skeleton */}
      <div className="space-y-4">
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
        </div>

        {/* Content Skeleton */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Skeleton className="size-5" />
              <Skeleton className="h-6 w-32" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-32" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-32" />
              </div>
            </div>
            <div className="space-y-2 border-t pt-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
