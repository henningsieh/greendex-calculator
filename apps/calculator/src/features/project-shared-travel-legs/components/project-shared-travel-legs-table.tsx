"use client";

import { useFormatter, useTranslations } from "@greendex/i18n/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { EditIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectSharedTravelLeg } from "@/features/project-shared-travel-legs/types";
import { PROJECT_ICONS } from "@/features/projects/components/project-icons";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

import { ProjectSharedTravelLegDialog } from "./project-shared-travel-leg-dialog";
import { TransportEmissionProfileIcon } from "./transport-emission-profile-icon";
import { TransportEmissionProfilePresentation } from "./transport-emission-profile-presentation";

interface ProjectSharedTravelLegsTableProps {
  projectId: string;
  canEdit?: boolean;
}

export function ProjectSharedTravelLegsTable({
  projectId,
  canEdit = false,
}: ProjectSharedTravelLegsTableProps) {
  const t = useTranslations("project.shared-travel");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSharedTravelLeg, setEditingSharedTravelLeg] = useState<
    ProjectSharedTravelLeg | undefined
  >();
  const [deletingSharedTravelLegId, setDeletingSharedTravelLegId] = useState<
    string | undefined
  >();
  const { data: sharedTravelLegs } = useSuspenseQuery(
    orpcQuery.projectSharedTravelLegs.list.queryOptions({
      input: { projectId },
    }),
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      orpc.projectSharedTravelLegs.delete({ projectId, id }),
    onSuccess: () => {
      toast.success(t("toast.delete-success"));
      void queryClient.invalidateQueries({
        queryKey: orpcQuery.projectSharedTravelLegs.list.queryKey({
          input: { projectId },
        }),
      });
      setDeletingSharedTravelLegId(undefined);
    },
    onError: () => {
      toast.error(t("toast.delete-error"));
    },
  });

  const handleFormSuccess = () => {
    setIsAddDialogOpen(false);
    setEditingSharedTravelLeg(undefined);
    void queryClient.invalidateQueries({
      queryKey: orpcQuery.projectSharedTravelLegs.list.queryKey({
        input: { projectId },
      }),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TransportEmissionProfileIcon
            className="size-5 text-secondary"
            profile="train"
          />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
        {canEdit && (
          <CardAction>
            <Button
              aria-label={t("form.title")}
              onClick={() => setIsAddDialogOpen(true)}
              size="sm"
              variant="secondaryoutline"
            >
              <PlusIcon className="size-4" />
              <span className="hidden sm:inline-flex">{t("form.title")}</span>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {sharedTravelLegs.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.type")}</TableHead>
                  <TableHead>{t("table.distance")}</TableHead>
                  <TableHead>{t("table.description")}</TableHead>
                  <TableHead>{t("table.date")}</TableHead>
                  {canEdit && (
                    <TableHead className="w-25">{t("table.actions")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sharedTravelLegs.map((sharedTravelLeg) => (
                  <TableRow key={sharedTravelLeg.id}>
                    <TableCell>
                      <TransportEmissionProfilePresentation
                        profile={sharedTravelLeg.transportEmissionProfile}
                      />
                    </TableCell>
                    <TableCell>
                      {sharedTravelLeg.distanceKm} {t("table.km")}
                    </TableCell>
                    <TableCell
                      /* eslint-disable-next-line shadcn/no-restyle -- Long descriptions intentionally truncate in this table column. */
                      className="max-w-50 truncate"
                    >
                      {sharedTravelLeg.description || "-"}
                    </TableCell>
                    <TableCell>
                      {sharedTravelLeg.travelDate
                        ? format.dateTime(new Date(sharedTravelLeg.travelDate), {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "-"}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            aria-label={t("table.edit")}
                            onClick={() =>
                              setEditingSharedTravelLeg(sharedTravelLeg)
                            }
                            size="icon"
                            variant="ghost"
                          >
                            <EditIcon className="size-4" />
                          </Button>
                          <Button
                            aria-label={t("table.delete")}
                            onClick={() =>
                              setDeletingSharedTravelLegId(sharedTravelLeg.id)
                            }
                            size="icon"
                            variant="ghost"
                          >
                            <Trash2Icon className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty
            /* eslint-disable-next-line shadcn/no-restyle -- Empty state intentionally has a table-style border. */
            className="border"
          >
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PROJECT_ICONS.sharedTravelLegs className="size-6" />
              </EmptyMedia>
              <EmptyTitle>{t("empty.title")}</EmptyTitle>
              <EmptyDescription>{t("empty.description")}</EmptyDescription>
            </EmptyHeader>
            {canEdit && (
              <EmptyContent>
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  <PlusIcon className="mr-2 size-4" />
                  {t("form.title")}
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}

        <ProjectSharedTravelLegDialog
          onOpenChange={setIsAddDialogOpen}
          onSuccess={handleFormSuccess}
          open={isAddDialogOpen}
          projectId={projectId}
        />
        <ProjectSharedTravelLegDialog
          onOpenChange={(open) => {
            if (!open) {
              setEditingSharedTravelLeg(undefined);
            }
          }}
          onSuccess={handleFormSuccess}
          open={editingSharedTravelLeg !== undefined}
          projectId={projectId}
          sharedTravelLeg={editingSharedTravelLeg}
        />
        <AlertDialog
          onOpenChange={(open) => {
            if (!open) {
              setDeletingSharedTravelLegId(undefined);
            }
          }}
          open={deletingSharedTravelLegId !== undefined}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("delete.confirm-title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("delete.confirm-description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                {t("delete.cancel-button")}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (deletingSharedTravelLegId) {
                    deleteMutation.mutate(deletingSharedTravelLegId);
                  }
                }}
                variant="destructive"
              >
                {deleteMutation.isPending
                  ? t("delete.deleting")
                  : t("delete.confirm-button")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
