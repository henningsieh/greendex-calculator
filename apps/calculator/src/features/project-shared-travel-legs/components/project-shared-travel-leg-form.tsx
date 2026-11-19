"use client";

import {
  DISTANCE_KM_STEP,
  MIN_DISTANCE_KM,
} from "@greendex/config/project-shared-travel";
import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { DatePickerWithInput } from "@/components/date-picker-with-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectSharedTravelLeg } from "@/features/project-shared-travel-legs/types";
import { ProjectSharedTravelLegFormSchema } from "@/features/project-shared-travel-legs/validation-schemas";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

import { TransportEmissionProfileSelect } from "./transport-emission-profile-select";

interface ProjectSharedTravelLegFormProps {
  projectId: string;
  sharedTravelLeg?: ProjectSharedTravelLeg;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type SharedTravelLegFormValues = z.infer<typeof ProjectSharedTravelLegFormSchema>;

export function ProjectSharedTravelLegForm({
  projectId,
  sharedTravelLeg,
  onSuccess,
  onCancel,
}: ProjectSharedTravelLegFormProps) {
  const t = useTranslations("project.shared-travel");
  const queryClient = useQueryClient();
  const isEditing = sharedTravelLeg !== undefined;
  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<SharedTravelLegFormValues>({
    resolver: zodResolver(ProjectSharedTravelLegFormSchema),
    mode: "onChange",
    defaultValues: sharedTravelLeg
      ? {
          transportEmissionProfile: sharedTravelLeg.transportEmissionProfile,
          distanceKm: sharedTravelLeg.distanceKm,
          description: sharedTravelLeg.description,
          travelDate: sharedTravelLeg.travelDate,
        }
      : {
          distanceKm: MIN_DISTANCE_KM,
          description: null,
          travelDate: null,
        },
  });

  const mutation = useMutation({
    mutationFn: (values: SharedTravelLegFormValues) => {
      if (sharedTravelLeg) {
        return orpc.projectSharedTravelLegs.update({
          projectId,
          id: sharedTravelLeg.id,
          data: values,
        });
      }

      return orpc.projectSharedTravelLegs.create({ projectId, ...values });
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(t(isEditing ? "toast.update-error" : "toast.create-error"));
        return;
      }

      queryClient.setQueryData(
        orpcQuery.projectSharedTravelLegs.list.queryOptions({
          input: { projectId },
        }).queryKey,
        (legs) =>
          legs?.map((leg) =>
            leg.id === result.sharedTravelLeg.id ? result.sharedTravelLeg : leg,
          ),
      );
      toast.success(
        t(isEditing ? "toast.update-success" : "toast.create-success"),
      );
      void queryClient.invalidateQueries({
        queryKey: orpcQuery.projectSharedTravelLegs.list.queryKey({
          input: { projectId },
        }),
      });
      onSuccess?.();
    },
    onError: (error) => {
      console.error(error);
      toast.error(t(isEditing ? "toast.update-error" : "toast.create-error"));
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={errors.transportEmissionProfile !== undefined}>
            <FieldLabel htmlFor="transportEmissionProfile">
              {t("form.transport-emission-profile")}
            </FieldLabel>
            <Controller
              control={control}
              name="transportEmissionProfile"
              render={({ field }) => (
                <TransportEmissionProfileSelect
                  id="transportEmissionProfile"
                  onValueChange={field.onChange}
                  value={field.value}
                />
              )}
            />
            <FieldError errors={[errors.transportEmissionProfile]} />
          </Field>

          <Field data-invalid={errors.distanceKm !== undefined}>
            <FieldLabel htmlFor="distanceKm">{t("form.distance")}</FieldLabel>
            <Controller
              control={control}
              name="distanceKm"
              render={({ field }) => (
                <Input
                  id="distanceKm"
                  min={MIN_DISTANCE_KM}
                  onChange={(event) => {
                    const value = Number.parseFloat(event.target.value);
                    field.onChange(Number.isFinite(value) ? value : undefined);
                  }}
                  placeholder={t("form.distance-placeholder")}
                  step={DISTANCE_KM_STEP}
                  type="number"
                  value={field.value ?? ""}
                />
              )}
            />
            <FieldError errors={[errors.distanceKm]} />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="description">{t("form.description")}</FieldLabel>
          <Textarea
            id="description"
            placeholder={t("form.description-placeholder")}
            {...register("description")}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="travelDate">{t("form.travel-date")}</FieldLabel>
          <Controller
            control={control}
            name="travelDate"
            render={({ field }) => (
              <DatePickerWithInput
                id="travelDate"
                onChange={field.onChange}
                value={field.value ?? undefined}
              />
            )}
          />
        </Field>

        <div className="flex gap-2">
          {onCancel && (
            <Button
              className="flex-1"
              disabled={mutation.isPending}
              onClick={onCancel}
              size="sm"
              type="button"
              variant="secondaryoutline"
            >
              {t("form.cancel")}
            </Button>
          )}
          <Button
            className="flex-1"
            disabled={mutation.isPending}
            size="sm"
            type="submit"
            variant="secondary"
          >
            {mutation.isPending
              ? t(isEditing ? "form.updating" : "form.adding")
              : t(isEditing ? "form.update" : "form.submit")}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
