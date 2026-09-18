/* eslint-disable shadcn/no-restyle -- This card intentionally owns its selectable and interactive presentation. */
"use client";

import { useFormatter, useLocale } from "@greendex/i18n/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarIcon,
  Edit2Icon,
  EyeIcon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { Location } from "@/components/location";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EditProjectForm,
  EditProjectFormSkeleton,
} from "@/features/projects/components/edit-project-form";
import type { ProjectType } from "@/features/projects/types";
import { getProjectDetailPath } from "@/features/projects/utils";
import { useProjectPermissions } from "@/lib/better-auth/permissions-utils";
import { Link } from "@/lib/i18n/routing";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

interface ProjectDetailCardProps {
  project: ProjectType;
  isSelected?: boolean;
  onSelectChange?: (value: boolean) => void;
}

export function ProjectCard({
  project,
  isSelected,
  onSelectChange,
}: ProjectDetailCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const format = useFormatter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  // Get user permissions
  const {
    canUpdate,
    canDelete,
    isPending: permissionsPending,
  } = useProjectPermissions();

  // Delete mutation
  const { mutateAsync: deleteProjectMutation, isPending: isDeleting } =
    useMutation({
      mutationFn: () =>
        orpc.projects.delete({
          id: project.id,
        }),
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Project deleted successfully");
          void queryClient.invalidateQueries({
            queryKey: orpcQuery.projects.list.queryKey(),
          });
        } else {
          toast.error("Failed to delete project");
        }
      },
      onError: (err: unknown) => {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message || "An error occurred while deleting the project");
      },
    });

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Are you sure?",
      description: `This will permanently delete the project "${project.name}". This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      isDestructive: true,
    });

    if (confirmed) {
      try {
        await deleteProjectMutation();
      } catch (error) {
        console.error("Delete failed:", error);
      }
    }
  };

  // Calculate status based on dates
  const now = new Date();
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  let status: "upcoming" | "active" | "completed" = "upcoming";
  if (now > endDate) {
    status = "completed";
  } else if (now >= startDate) {
    status = "active";
  }

  return (
    <>
      <div className="group relative h-full">
        <Link
          className="block h-full focus:outline-none"
          href={getProjectDetailPath(project.id)}
          onClick={(e) => {
            if (
              e.target instanceof HTMLElement &&
              e.target.closest('[role="checkbox"]')
            ) {
              e.preventDefault();
            }
          }}
        >
          <Card
            className={cn(
              "relative flex h-full flex-col overflow-hidden transition-all duration-200 hover:border-primary/50 hover:shadow-md",
              isSelected && "border-primary bg-primary/5 ring-1 ring-primary",
            )}
          >
            <CardHeader>
              <div className="space-y-2">
                <div className="flex items-start">
                  {onSelectChange && (
                    <Checkbox
                      aria-label={`Select ${project.name}`}
                      checked={isSelected}
                      className="size-5 border-2 bg-background data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                      onCheckedChange={onSelectChange}
                    />
                  )}
                  <h3
                    className="line-clamp-2 min-w-0 flex-1 text-lg leading-tight font-semibold tracking-tight"
                    title={project.name}
                  >
                    {project.name}
                  </h3>
                </div>
                <Location
                  countryCode={project.country}
                  locale={locale}
                  location={project.location}
                  showFlag={true}
                />
              </div>
              <CardAction className="p-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className={cn(
                        "size-8 bg-background/80 backdrop-blur-sm transition-opacity hover:bg-background",
                        "focus:opacity-100",
                      )}
                      onClick={(e) => e.stopPropagation()}
                      size="icon"
                      variant="ghost"
                    >
                      <span className="sr-only">Open actions</span>
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link
                        className="flex items-center gap-2"
                        href={getProjectDetailPath(project.id)}
                      >
                        <EyeIcon className="mr-2 size-4" />
                        <span>View Details</span>
                      </Link>
                    </DropdownMenuItem>
                    {canUpdate && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditModalOpen(true);
                        }}
                      >
                        <Edit2Icon className="mr-2 size-4" />
                        Edit Project
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={isDeleting || permissionsPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete();
                          }}
                        >
                          <Trash2Icon className="mr-2 size-4" />
                          Delete Project
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardAction>
            </CardHeader>

            <CardContent className="flex-1 pb-3">
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarIcon className="size-4" />
                    <span>Start Date</span>
                  </div>
                  <p className="font-medium">
                    {format.dateTime(startDate, {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarIcon className="size-4" />
                    <span>End Date</span>
                  </div>
                  <p className="font-medium">
                    {format.dateTime(endDate, {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-0">
              <div className="flex w-full items-center justify-between">
                <Badge
                  className={cn(
                    "pointer-events-none font-normal",
                    status === "active" &&
                      "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300",
                    status === "completed" &&
                      "border-secondary bg-secondary/50 text-muted-foreground",
                    status === "upcoming" &&
                      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
                  )}
                  variant="outline"
                >
                  {status === "active" && "Active"}
                  {status === "completed" && "Completed"}
                  {status === "upcoming" && "Upcoming"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Created{" "}
                  {format.relativeTime(new Date(project.createdAt), { now })}
                </span>
              </div>
            </CardFooter>
          </Card>
        </Link>
      </div>

      {canUpdate && (
        <Dialog onOpenChange={setIsEditModalOpen} open={isEditModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
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

      <ConfirmDialogComponent />
    </>
  );
}
