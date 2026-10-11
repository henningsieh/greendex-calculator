"use client";

import {
  DISTANCE_KM_STEP,
  MIN_DISTANCE_KM,
} from "@greendex/config/project-shared-travel";
import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

import { CountrySelect } from "@/components/country-select";
import { DatePickerWithInput } from "@/components/date-picker-with-input";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TransportEmissionProfileSelect } from "@/features/project-shared-travel-legs/components/transport-emission-profile-select";
import {
  PROJECT_FORM_STEPS,
  PROJECT_FORM_TOTAL_STEPS,
} from "@/features/projects/project-form-steps";
import { DEFAULT_PROJECT_DURATION_DAYS } from "@/features/projects/types";
import {
  getProjectDetailPath,
  MILLISECONDS_PER_DAY,
} from "@/features/projects/utils";
import type { CreateProjectWithSharedTravelLegs } from "@/features/projects/validation-schemas";
import { CreateProjectWithSharedTravelLegsSchema } from "@/features/projects/validation-schemas";
import { useRouter } from "@/lib/i18n/routing";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

interface CreateProjectFormProps {
  activeOrganizationId: string;
}

/**
 * Render a two-step form for creating a project and optional Project Shared Travel Legs.
 *
 * Step 1 collects project details (name, dates, country, location, welcome message).
 * Step 2 collects zero or more shared travel legs using the canonical profile and validation contract.
 * Submitting creates the project and its provided shared travel legs, then navigates to the project details page.
 *
 * @param activeOrganizationId - ID of the active organization used as the project's organizationId default
 * @returns The CreateProjectForm React element
 */
export function CreateProjectForm({
  activeOrganizationId,
}: CreateProjectFormProps) {
  const tSharedTravel = useTranslations("project.shared-travel");
  const t = useTranslations("organization.projects.form.new");
  const [currentStep, setCurrentStep] = useState<number>(
    PROJECT_FORM_STEPS.PROJECT_DETAILS,
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    trigger,
  } = useForm<CreateProjectWithSharedTravelLegs>({
    resolver: zodResolver(CreateProjectWithSharedTravelLegsSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      startDate: new Date(),
      endDate: new Date(
        Date.now() + DEFAULT_PROJECT_DURATION_DAYS * MILLISECONDS_PER_DAY,
      ),
      country: undefined,
      location: "",
      welcomeMessage: undefined,
      organizationId: activeOrganizationId,
      sharedTravelLegs: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sharedTravelLegs",
  });

  const queryClient = useQueryClient();
  const router = useRouter();

  const { mutateAsync: createProjectMutation, isPending: isCreatingProject } =
    useMutation({
      mutationFn: (values: CreateProjectWithSharedTravelLegs) =>
        orpc.projects.create({
          name: values.name,
          startDate: values.startDate,
          endDate: values.endDate,
          location: values.location,
          country: values.country,
          welcomeMessage: values.welcomeMessage,
          organizationId: values.organizationId,
        }),
      onError: (err: unknown) => {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message || t("toast.error-generic"));
      },
    });

  const { mutateAsync: createSharedTravelLegMutation } = useMutation({
    mutationFn: ({
      projectId,
      sharedTravelLeg,
    }: {
      projectId: string;
      sharedTravelLeg: NonNullable<
        CreateProjectWithSharedTravelLegs["sharedTravelLegs"]
      >[number];
    }) =>
      orpc.projectSharedTravelLegs.create({
        projectId,
        ...sharedTravelLeg,
      }),
  });

  /**
   * Validate required project fields for step 1 and advance the form to step 2 when validation succeeds.
   *
   * Triggers validation for "name", "startDate", "endDate", and "country". If all validations pass, updates the form state to move to step 2.
   */
  async function handleNextStep() {
    // Validate step 1 fields before proceeding
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

  /**
   * Create each supplied Project Shared Travel Leg and collect any failures.
   */
  async function createSharedTravelLegsForProject(
    projectId: string,
    sharedTravelLegs?: CreateProjectWithSharedTravelLegs["sharedTravelLegs"],
  ) {
    const failedProfiles: string[] = [];
    if (!sharedTravelLegs || sharedTravelLegs.length === 0) {
      return failedProfiles;
    }

    for (const sharedTravelLeg of sharedTravelLegs) {
      try {
        await createSharedTravelLegMutation({ projectId, sharedTravelLeg });
      } catch (error) {
        console.error("Failed to create Project Shared Travel Leg:", error);
        failedProfiles.push(sharedTravelLeg.transportEmissionProfile);
      }
    }

    return failedProfiles;
  }

  /**
   * Create a project and its associated Project Shared Travel Legs.
   */
  async function onSubmit(values: CreateProjectWithSharedTravelLegs) {
    try {
      // Create the project first
      const result = await createProjectMutation(values);

      if (!result.success) {
        toast.error(t("toast.error"));
        return;
      }

      const failedProfiles = await createSharedTravelLegsForProject(
        result.project.id,
        values.sharedTravelLegs,
      );

      if (failedProfiles.length > 0) {
        toast.error(
          t("toast.failed-shared-travel-legs", {
            count: failedProfiles.length,
            profiles: failedProfiles.join(", "),
          }),
        );
      }

      toast.success(t("toast.success"));
      router.push(getProjectDetailPath(result.project.id));
      void queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.list.queryKey(),
      });
    } catch (err) {
      console.error(err);
      toast.error(t("toast.error-generic"));
    }
  }

  const addSharedTravelLeg = () => {
    append({
      transportEmissionProfile: "train",
      distanceKm: MIN_DISTANCE_KM,
      description: null,
      travelDate: null,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldSet className="mx-auto max-w-3xl p-2 sm:p-6">
        <FieldContent>
          <FieldLegend>{t("legend")}</FieldLegend>
          <p className="text-right text-sm text-muted-foreground">
            {t("step", {
              current: currentStep,
              total: PROJECT_FORM_TOTAL_STEPS,
            })}
          </p>
        </FieldContent>

        {/* Step 1: Project Details */}
        {currentStep === PROJECT_FORM_STEPS.PROJECT_DETAILS && (
          <FieldGroup>
            <FormField
              control={control}
              description={t("name-description")}
              label={t("name")}
              name="name"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.startDate}>
                <FieldLabel htmlFor="startDate">{t("start-date")}</FieldLabel>
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
                <FieldDescription>{t("start-date-description")}</FieldDescription>
                <FieldError errors={[errors.startDate]} />
              </Field>

              <Field data-invalid={!!errors.endDate}>
                <FieldLabel htmlFor="endDate">{t("end-date")}</FieldLabel>
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
                <FieldDescription>{t("end-date-description")}</FieldDescription>
                <FieldError errors={[errors.endDate]} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.country}>
                <FieldLabel htmlFor="country">{t("country")}</FieldLabel>
                <Controller
                  control={control}
                  name="country"
                  render={({ field }) => (
                    <CountrySelect
                      euOnly={true}
                      onValueChange={field.onChange}
                      placeholder={t("country-placeholder")}
                      value={field.value}
                    />
                  )}
                />
                <FieldDescription>{t("country-description")}</FieldDescription>
                <FieldError errors={[errors.country]} />
              </Field>

              <FormField
                control={control}
                description={t("location-description")}
                label={t("location")}
                name="location"
              />
            </div>

            <Field>
              <FieldLabel htmlFor="welcomeMessage">
                {t("welcome-message")}
              </FieldLabel>
              <Textarea id="welcomeMessage" {...register("welcomeMessage")} />
              <FieldDescription>
                {t("welcome-message-description")}
              </FieldDescription>
            </Field>

            <Button
              className="w-fit"
              onClick={handleNextStep}
              type="button"
              variant="secondary"
            >
              {tSharedTravel("title")}
              <ArrowRightIcon className="ml-2 size-4" />
            </Button>
          </FieldGroup>
        )}

        {/* Step 2: Project Shared Travel (Optional) */}
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
                {fields.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    {tSharedTravel("empty.description")}
                  </p>
                ) : (
                  fields.map((field, index) => (
                    <div
                      className="relative rounded-lg border p-4"
                      key={field.id}
                    >
                      <Button
                        className="absolute top-2 right-2"
                        onClick={() => remove(index)}
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
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === "") {
                                    field.onChange(undefined);
                                  } else {
                                    const num = Number.parseFloat(raw);
                                    if (Number.isFinite(num)) {
                                      field.onChange(num);
                                    } else {
                                      field.onChange(undefined);
                                    }
                                  }
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
                  ))
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
                {t("back")}
              </Button>

              <Button
                className="w-fit"
                disabled={isCreatingProject}
                type="submit"
                variant="secondary"
              >
                {isCreatingProject ? (
                  t("creating")
                ) : (
                  <>
                    <CheckIcon className="mr-2 size-4" />
                    {t("create-project")}
                  </>
                )}
              </Button>
            </div>
          </FieldGroup>
        )}
      </FieldSet>
    </form>
  );
}
