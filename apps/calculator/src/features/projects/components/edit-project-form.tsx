"use client";

import {
  DISTANCE_KM_STEP,
  MIN_DISTANCE_KM,
} from "@greendex/config/project-shared-travel";
import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { CountrySelect } from "@/components/country-select";
import { DatePickerWithInput } from "@/components/date-picker-with-input";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { TransportEmissionProfileSelect } from "@/features/project-shared-travel-legs/components/transport-emission-profile-select";
import {
  PROJECT_FORM_STEPS,
  PROJECT_FORM_TOTAL_STEPS,
} from "@/features/projects/project-form-steps";
import type { ProjectType } from "@/features/projects/types";
import { EditProjectWithSharedTravelLegsSchema } from "@/features/projects/validation-schemas";
import { orpcQuery } from "@/lib/orpc/orpc";

interface EditProjectFormProps {
  project: ProjectType;
  onSuccess?: () => void;
}

/**
 * Render a two-step form that edits a project's details and manages its Project Shared Travel Legs, then persists changes.
 *
 * @param project - Project used to populate initial form values.
 * @param onSuccess - Optional callback invoked after a successful project update and shared-travel processing.
 * @returns The rendered edit project form UI.
 */
export function EditProjectForm({ project, onSuccess }: EditProjectFormProps) {
  const tSharedTravel = useTranslations("project.shared-travel");
  const t = useTranslations("organization.projects.form");
  const [currentStep, setCurrentStep] = useState<number>(
    PROJECT_FORM_STEPS.PROJECT_DETAILS,
  );

  // Fetch existing Project Shared Travel Legs.
  const { data: existingSharedTravelLegs } = useSuspenseQuery(
    orpcQuery.projectSharedTravelLegs.list.queryOptions({
      input: { projectId: project.id },
    }),
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    trigger,
    setValue,
    getValues,
  } = useForm<z.infer<typeof EditProjectWithSharedTravelLegsSchema>>({
    resolver: zodResolver(EditProjectWithSharedTravelLegsSchema),
    mode: "onChange",
    defaultValues: {
      name: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
      location: project.location,
      country: project.country,
      welcomeMessage: project.welcomeMessage,
      organizationId: project.organizationId,
      sharedTravelLegs: [],
    },
  });

  // Keep fetched canonical legs (including IDs) in the form for later updates.
  useEffect(() => {
    setValue(
      "sharedTravelLegs",
      existingSharedTravelLegs.map((sharedTravelLeg) => ({
        id: sharedTravelLeg.id,
        projectId: sharedTravelLeg.projectId,
        transportEmissionProfile: sharedTravelLeg.transportEmissionProfile,
        distanceKm: sharedTravelLeg.distanceKm,
        description: sharedTravelLeg.description,
        travelDate: sharedTravelLeg.travelDate
          ? new Date(sharedTravelLeg.travelDate)
          : null,
        isNew: false,
        isDeleted: false,
      })),
    );
  }, [existingSharedTravelLegs, setValue]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sharedTravelLegs",
  });

  const queryClient = useQueryClient();

  const { mutateAsync: updateProjectMutation, isPending: isUpdating } =
    useMutation(
      orpcQuery.projects.update.mutationOptions({
        onError: (error) => {
          console.error(error);
          toast.error(t("edit.toast.error"));
        },
      }),
    );

  const { mutateAsync: createSharedTravelLegMutation } = useMutation(
    orpcQuery.projectSharedTravelLegs.create.mutationOptions(),
  );

  const { mutateAsync: updateSharedTravelLegMutation } = useMutation(
    orpcQuery.projectSharedTravelLegs.update.mutationOptions(),
  );

  const { mutateAsync: deleteSharedTravelLegMutation } = useMutation(
    orpcQuery.projectSharedTravelLegs.delete.mutationOptions(),
  );

  async function handleNextStep() {
    const isStepValid = await trigger([
      "name",
      "startDate",
      "endDate",
      "country",
    ]);
    if (isStepValid) {
      setCurrentStep(PROJECT_FORM_STEPS.PROJECT_SHARED_TRAVEL);
    }
  }

  async function onSubmit(
    values: z.infer<typeof EditProjectWithSharedTravelLegsSchema>,
  ) {
    const result = await updateProjectMutation({
      id: project.id,
      data: {
        name: values.name,
        startDate: values.startDate,
        endDate: values.endDate,
        location: values.location,
        country: values.country,
        welcomeMessage: values.welcomeMessage,
        organizationId: values.organizationId,
      },
    });

    if (!result.success) {
      toast.error(t("edit.toast.error"));
      return;
    }

    if (values.sharedTravelLegs && values.sharedTravelLegs.length > 0) {
      const failedProfiles = await processSharedTravelLegs(
        values.sharedTravelLegs,
      );

      if (failedProfiles.length > 0) {
        toast.error(
          t("edit.toast.failed-shared-travel-legs", {
            count: failedProfiles.length,
            profiles: failedProfiles.join(", "),
          }),
        );
      }
    }

    toast.success(t("edit.toast.success"));
    invalidateProjectQueries(project.id);
    onSuccess?.();
  }

  async function processSharedTravelLegs(
    sharedTravelLegs: NonNullable<
      z.infer<typeof EditProjectWithSharedTravelLegsSchema>["sharedTravelLegs"]
    >,
  ) {
    const failedProfiles: string[] = [];

    for (const sharedTravelLeg of sharedTravelLegs) {
      try {
        await handleSharedTravelLeg(sharedTravelLeg);
      } catch (error) {
        console.error("Failed to process Project Shared Travel Leg:", error);
        failedProfiles.push(
          sharedTravelLeg.transportEmissionProfile || "unknown",
        );
      }
    }

    return failedProfiles;
  }

  async function handleSharedTravelLeg(
    sharedTravelLeg: NonNullable<
      z.infer<typeof EditProjectWithSharedTravelLegsSchema>["sharedTravelLegs"]
    >[number],
  ) {
    if (
      sharedTravelLeg.isDeleted &&
      !sharedTravelLeg.isNew &&
      sharedTravelLeg.id
    ) {
      await deleteSharedTravelLegMutation({
        projectId: project.id,
        id: sharedTravelLeg.id,
      });
      return;
    }

    if (sharedTravelLeg.isNew && !sharedTravelLeg.isDeleted) {
      await createSharedTravelLegMutation({
        projectId: project.id,
        transportEmissionProfile: sharedTravelLeg.transportEmissionProfile,
        distanceKm: sharedTravelLeg.distanceKm,
        description: sharedTravelLeg.description,
        travelDate: sharedTravelLeg.travelDate,
      });
      return;
    }

    if (
      !sharedTravelLeg.isNew &&
      !sharedTravelLeg.isDeleted &&
      sharedTravelLeg.id
    ) {
      await updateSharedTravelLegMutation({
        projectId: project.id,
        id: sharedTravelLeg.id,
        data: {
          transportEmissionProfile: sharedTravelLeg.transportEmissionProfile,
          distanceKm: sharedTravelLeg.distanceKm,
          description: sharedTravelLeg.description,
          travelDate: sharedTravelLeg.travelDate,
        },
      });
    }
  }

  /**
   * Invalidates cached queries related to a project so they will be refetched.
   *
   * @param projectId - The ID of the project whose list, details, and shared-travel caches should be invalidated
   */
  function invalidateProjectQueries(projectId: string) {
    void queryClient.invalidateQueries({
      queryKey: orpcQuery.projects.list.queryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: orpcQuery.projects.getById.queryOptions({
        input: { id: projectId },
      }).queryKey,
    });
    void queryClient.invalidateQueries({
      queryKey: orpcQuery.projectSharedTravelLegs.list.queryKey({
        input: { projectId },
      }),
    });
  }

  const addSharedTravelLeg = () => {
    append({
      id: "",
      projectId: project.id,
      transportEmissionProfile: "car",
      distanceKm: MIN_DISTANCE_KM,
      description: null,
      travelDate: null,
      isNew: true,
      isDeleted: false,
    });
  };

  const markSharedTravelLegDeleted = (index: number) => {
    const sharedTravelLegs = getValues("sharedTravelLegs") || [];
    const sharedTravelLeg = sharedTravelLegs[index];

    if (sharedTravelLeg.isNew) {
      remove(index);
    } else {
      const updatedSharedTravelLegs = [...sharedTravelLegs];
      updatedSharedTravelLegs[index] = {
        ...sharedTravelLeg,
        isDeleted: true,
      };
      setValue("sharedTravelLegs", updatedSharedTravelLegs);
    }
  };

  const visibleSharedTravelLegs = fields.filter((field) => !field.isDeleted);

  return (
    <div>
      <Toaster />

      <form
        onSubmit={handleSubmit(onSubmit, (formErrors) => {
          console.error("Form validation errors:", formErrors);
          toast.error(t("edit.validation-error"));
        })}
      >
        {/* Step indicator */}
        <p className="mb-4 text-sm text-muted-foreground">
          {t("edit.step", {
            current: currentStep,
            total: PROJECT_FORM_TOTAL_STEPS,
          })}
        </p>

        {/* Step 1: Project Details */}
        {currentStep === PROJECT_FORM_STEPS.PROJECT_DETAILS && (
          <FieldGroup>
            <FormField control={control} label={t("new.name")} name="name" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.startDate}>
                <FieldLabel htmlFor="startDate">{t("new.start-date")}</FieldLabel>
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePickerWithInput
                      id="startDate"
                      onChange={field.onChange}
                      value={field.value}
                    />
                  )}
                />
                <FieldError errors={[errors.startDate]} />
              </Field>

              <Field data-invalid={!!errors.endDate}>
                <FieldLabel htmlFor="endDate">{t("new.end-date")}</FieldLabel>
                <Controller
                  control={control}
                  name="endDate"
                  render={({ field }) => (
                    <DatePickerWithInput
                      id="endDate"
                      onChange={field.onChange}
                      value={field.value}
                    />
                  )}
                />
                <FieldError errors={[errors.endDate]} />
              </Field>
            </div>

            <Field data-invalid={!!errors.country}>
              <FieldLabel htmlFor="country">{t("new.country")}</FieldLabel>
              <Controller
                control={control}
                name="country"
                render={({ field }) => (
                  <CountrySelect
                    euOnly={true}
                    onValueChange={field.onChange}
                    placeholder={t("new.country-placeholder") || "Select country"}
                    value={field.value}
                  />
                )}
              />
              <FieldError errors={[errors.country]} />
            </Field>

            <FormField
              control={control}
              label={t("new.location")}
              name="location"
            />

            <Field>
              <FieldLabel htmlFor="welcomeMessage">
                {t("new.welcome-message")}
              </FieldLabel>
              <Textarea id="welcomeMessage" {...register("welcomeMessage")} />
            </Field>

            <div className="flex gap-2">
              <Button
                className="w-1/2"
                onClick={() => onSuccess?.()}
                type="button"
                variant="secondaryoutline"
              >
                {t("edit.cancel")}
              </Button>
              <Button
                className="w-1/2"
                onClick={handleNextStep}
                type="button"
                variant="secondary"
              >
                {tSharedTravel("title")}
                <ArrowRightIcon className="ml-2 size-4" />
              </Button>
            </div>
          </FieldGroup>
        )}

        {/* Step 2: Project Shared Travel */}
        {currentStep === PROJECT_FORM_STEPS.PROJECT_SHARED_TRAVEL && (
          <FieldGroup>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {tSharedTravel("title")}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {tSharedTravel("description")}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {visibleSharedTravelLegs.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <PlusIcon className="size-9 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle>{tSharedTravel("empty.title")}</EmptyTitle>
                      <EmptyDescription>
                        {tSharedTravel("empty.description")}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  fields.map((field, index) => {
                    if (field.isDeleted) {
                      return null;
                    }
                    return (
                      <div
                        className="relative rounded-lg border p-4"
                        key={field.id}
                      >
                        <Button
                          className="absolute top-2 right-2"
                          onClick={() => markSharedTravelLegDeleted(index)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2Icon className="size-4 text-destructive" />
                        </Button>

                        <div className="grid gap-4 pr-8 sm:grid-cols-2">
                          <Field
                            data-invalid={
                              !!errors.sharedTravelLegs?.[index]
                                ?.transportEmissionProfile
                            }
                          >
                            <FieldLabel
                              htmlFor={`sharedTravelLegs.${index}.transportEmissionProfile`}
                            >
                              {tSharedTravel("form.transport-emission-profile")}
                            </FieldLabel>
                            <Controller
                              control={control}
                              name={`sharedTravelLegs.${index}.transportEmissionProfile`}
                              render={({ field: selectField }) => (
                                <TransportEmissionProfileSelect
                                  id={`sharedTravelLegs.${index}.transportEmissionProfile`}
                                  onValueChange={selectField.onChange}
                                  value={selectField.value}
                                />
                              )}
                            />
                            <FieldError
                              errors={[
                                errors.sharedTravelLegs?.[index]
                                  ?.transportEmissionProfile,
                              ]}
                            />
                          </Field>

                          <Field
                            data-invalid={
                              !!errors.sharedTravelLegs?.[index]?.distanceKm
                            }
                          >
                            <FieldLabel
                              htmlFor={`sharedTravelLegs.${index}.distanceKm`}
                            >
                              {tSharedTravel("form.distance")}
                            </FieldLabel>
                            <Controller
                              control={control}
                              name={`sharedTravelLegs.${index}.distanceKm`}
                              render={({ field }) => (
                                <Input
                                  id={`sharedTravelLegs.${index}.distanceKm`}
                                  min={MIN_DISTANCE_KM}
                                  onChange={(event) => {
                                    const value = Number.parseFloat(
                                      event.target.value,
                                    );
                                    field.onChange(
                                      Number.isFinite(value) ? value : undefined,
                                    );
                                  }}
                                  placeholder={tSharedTravel(
                                    "form.distance-placeholder",
                                  )}
                                  step={DISTANCE_KM_STEP}
                                  type="number"
                                  value={field.value ?? ""}
                                />
                              )}
                            />
                            <FieldError
                              errors={[
                                errors.sharedTravelLegs?.[index]?.distanceKm,
                              ]}
                            />
                          </Field>
                        </div>

                        <Field className="mt-4">
                          <FieldLabel
                            htmlFor={`sharedTravelLegs.${index}.description`}
                          >
                            {tSharedTravel("form.description")}
                          </FieldLabel>
                          <Textarea
                            id={`sharedTravelLegs.${index}.description`}
                            placeholder={tSharedTravel(
                              "form.description-placeholder",
                            )}
                            {...register(`sharedTravelLegs.${index}.description`)}
                          />
                        </Field>

                        <Field className="mt-4">
                          <FieldLabel
                            htmlFor={`sharedTravelLegs.${index}.travelDate`}
                          >
                            {tSharedTravel("form.travel-date")}
                          </FieldLabel>
                          <Controller
                            control={control}
                            name={`sharedTravelLegs.${index}.travelDate`}
                            render={({ field: travelDateField }) => (
                              <DatePickerWithInput
                                id={`sharedTravelLegs.${index}.travelDate`}
                                onChange={travelDateField.onChange}
                                value={travelDateField.value ?? undefined}
                              />
                            )}
                          />
                        </Field>
                      </div>
                    );
                  })
                )}

                <Button
                  className="w-full"
                  onClick={addSharedTravelLeg}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <PlusIcon className="mr-2 size-4" />
                  {tSharedTravel("form.title")}
                </Button>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                className="w-fit"
                onClick={() => setCurrentStep(PROJECT_FORM_STEPS.PROJECT_DETAILS)}
                type="button"
                variant="outline"
              >
                <ArrowLeftIcon className="mr-2 size-4" />
                {t("edit.back")}
              </Button>

              <Button className="w-fit" disabled={isUpdating} type="submit">
                {isUpdating ? (
                  tSharedTravel("form.updating")
                ) : (
                  <>
                    <CheckIcon className="mr-2 size-4" />
                    {t("edit.update") || "Update Project"}
                  </>
                )}
              </Button>
            </div>
          </FieldGroup>
        )}
      </form>
    </div>
  );
}

/**
 * Skeleton component for EditProjectForm loading state
 */
export function EditProjectFormSkeleton() {
  return (
    <div className="space-y-6">
      {/* Step indicator skeleton */}
      <Skeleton className="h-4 w-24" />

      {/* Form fields skeleton */}
      <div className="space-y-4">
        {/* Name field */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Date fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Country field */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Location field */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Welcome message field */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>

        {/* Button */}
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
