"use client";

import { useLocale, useTranslations } from "@greendex/i18n/client";
import { useDateFormat } from "@greendex/i18n/datetime/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarRangeIcon, LoaderCircleIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { projectPath } from "@/app/paths";
import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { EUCountrySelector } from "@/components/eu-country-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  PROJECT_LOCATION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_WELCOME_MAX_LENGTH,
  ProjectCreateInputSchema,
  createProjectCreateInputSchema,
} from "@/features/projects/validation-schemas";
import { useRouter } from "@/lib/i18n/routing";
import { orpc } from "@/lib/orpc/orpc";

type Details = z.input<typeof ProjectCreateInputSchema>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Dates travel as UTC midnights; the native date field needs the plain day. */
function dateInputValue(value: unknown): string {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString().slice(0, 10)
    : "";
}

function dateFromInput(value: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function spanInDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

export function CreateProjectDialog() {
  const router = useRouter();
  const t = useTranslations("projects.create");
  const locale = useLocale();
  const dateFormat = useDateFormat();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<React.ReactNode>(null);

  const schema = useMemo(
    () =>
      createProjectCreateInputSchema({
        nameRequired: t("errors.nameRequired"),
        locationRequired: t("errors.locationRequired"),
        countryRequired: t("errors.countryRequired"),
        startDateRequired: t("errors.startDateRequired"),
        endDateRequired: t("errors.endDateRequired"),
        endBeforeStart: t("errors.endBeforeStart"),
        tooLong: (count) => t("errors.tooLong", { count }),
      }),
    [t],
  );
  const resolver = useMemo(() => zodResolver(schema), [schema]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    clearErrors,
    reset,
  } = useForm<Details>({
    resolver,
    mode: "onTouched",
    defaultValues: { name: "", location: "", welcomeMessage: "" },
  });

  const startDate = useWatch({ control, name: "startDate" });
  const endDate = useWatch({ control, name: "endDate" });
  const welcomeMessage = useWatch({ control, name: "welcomeMessage" }) ?? "";
  const welcomeLength = welcomeMessage.length;
  const charactersLeft = PROJECT_WELCOME_MAX_LENGTH - welcomeLength;
  const welcomeDescribedBy = [
    "new-project-welcome-hint",
    "new-project-welcome-count",
    errors.welcomeMessage ? "new-project-welcome-error" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const span =
    startDate instanceof Date && endDate instanceof Date && endDate >= startDate
      ? {
          label: dateFormat.range(startDate, endDate, "date.medium"),
          days: spanInDays(startDate, endDate),
        }
      : null;

  const submit = handleSubmit(async (values) => {
    setSubmitError(undefined);
    try {
      const { id } = await orpc.projects.create(values);
      setOpen(false);
      reset();
      router.push(projectPath(id));
    } catch (error) {
      setSubmitError(<ErrorPresentation error={error} />);
    }
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && !isSubmitting) {
      setSubmitError(undefined);
      clearErrors();
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger data-testid="new-project" render={<Button type="button" />}>
        {t("submit")}
      </DialogTrigger>
      <DialogContent
        closeLabel={t("close")}
        data-testid="create-project-dialog"
        variant="form"
      >
        <DialogHeader variant="form">
          <div className="flex flex-col gap-2">
            <DialogTitle size="lg">{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </div>
          {span ? (
            <p
              className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
              data-days={span.days}
              data-testid="create-project-span"
            >
              <CalendarRangeIcon aria-hidden="true" className="size-3.5" />
              <span className="tabular-nums">{span.label}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {t("spanDays", { count: span.days })}
              </span>
            </p>
          ) : null}
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={submit}
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <FieldGroup className="gap-6">
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="new-project-name">
                  <span>{t("name")}</span>
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <Input
                  aria-describedby={
                    errors.name ? "new-project-name-error" : undefined
                  }
                  aria-invalid={!!errors.name}
                  aria-required="true"
                  autoComplete="off"
                  data-testid="new-project-name"
                  id="new-project-name"
                  maxLength={PROJECT_NAME_MAX_LENGTH}
                  placeholder={t("namePlaceholder")}
                  {...register("name")}
                />
                <FieldError
                  data-error-type={errors.name?.type}
                  data-testid="new-project-name-error"
                  errors={[errors.name]}
                  id="new-project-name-error"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.location}>
                  <FieldLabel htmlFor="new-project-location">
                    <span>{t("location")}</span>
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FieldLabel>
                  <Input
                    aria-describedby={
                      errors.location ? "new-project-location-error" : undefined
                    }
                    aria-invalid={!!errors.location}
                    aria-required="true"
                    autoComplete="address-level2"
                    data-testid="new-project-location"
                    id="new-project-location"
                    maxLength={PROJECT_LOCATION_MAX_LENGTH}
                    placeholder={t("locationPlaceholder")}
                    {...register("location")}
                  />
                  <FieldError
                    data-error-type={errors.location?.type}
                    data-testid="new-project-location-error"
                    errors={[errors.location]}
                    id="new-project-location-error"
                  />
                </Field>

                <Field data-invalid={!!errors.country}>
                  <FieldLabel htmlFor="new-project-country">
                    <span>{t("country")}</span>
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="country"
                    render={({ field, fieldState }) => (
                      <EUCountrySelector
                        ref={field.ref}
                        aria-describedby={
                          fieldState.error
                            ? "new-project-country-error"
                            : undefined
                        }
                        aria-invalid={fieldState.invalid}
                        aria-required="true"
                        variant="field"
                        data-testid="new-project-country"
                        disabled={isSubmitting}
                        id="new-project-country"
                        onBlur={field.onBlur}
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      />
                    )}
                  />
                  <FieldError
                    data-error-type={errors.country?.type}
                    data-testid="new-project-country-error"
                    errors={[errors.country]}
                    id="new-project-country-error"
                  />
                </Field>
              </div>

              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={!!errors.startDate}>
                  <FieldLabel htmlFor="new-project-start">
                    <span>{t("startDate")}</span>
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="startDate"
                    render={({ field, fieldState }) => (
                      <Input
                        ref={field.ref}
                        aria-describedby={
                          fieldState.error ? "new-project-start-error" : undefined
                        }
                        aria-invalid={fieldState.invalid}
                        aria-required="true"
                        data-testid="new-project-start"
                        id="new-project-start"
                        lang={locale}
                        onBlur={field.onBlur}
                        onChange={(event) =>
                          field.onChange(dateFromInput(event.target.value))
                        }
                        type="date"
                        value={dateInputValue(field.value)}
                      />
                    )}
                  />
                  <FieldError
                    data-error-type={errors.startDate?.type}
                    data-testid="new-project-start-error"
                    errors={[errors.startDate]}
                    id="new-project-start-error"
                  />
                </Field>

                <Field data-invalid={!!errors.endDate}>
                  <FieldLabel htmlFor="new-project-end">
                    <span>{t("endDate")}</span>
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="endDate"
                    render={({ field, fieldState }) => (
                      <Input
                        ref={field.ref}
                        aria-describedby={
                          fieldState.error ? "new-project-end-error" : undefined
                        }
                        aria-invalid={fieldState.invalid}
                        aria-required="true"
                        data-testid="new-project-end"
                        id="new-project-end"
                        lang={locale}
                        min={dateInputValue(startDate) || undefined}
                        onBlur={field.onBlur}
                        onChange={(event) =>
                          field.onChange(dateFromInput(event.target.value))
                        }
                        type="date"
                        value={dateInputValue(field.value)}
                      />
                    )}
                  />
                  <FieldError
                    data-error-type={errors.endDate?.type}
                    data-testid="new-project-end-error"
                    errors={[errors.endDate]}
                    id="new-project-end-error"
                  />
                </Field>
              </div>
              <FieldDescription>{t("scheduleHint")}</FieldDescription>

              <Separator />
              <Field data-invalid={!!errors.welcomeMessage}>
                <FieldLabel htmlFor="new-project-welcome">
                  {t("welcomeMessage")}
                </FieldLabel>
                <Textarea
                  aria-describedby={welcomeDescribedBy}
                  aria-invalid={!!errors.welcomeMessage}
                  className="max-h-48 min-h-28"
                  data-testid="new-project-welcome"
                  id="new-project-welcome"
                  maxLength={PROJECT_WELCOME_MAX_LENGTH}
                  placeholder={t("welcomePlaceholder")}
                  {...register("welcomeMessage")}
                />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <FieldDescription id="new-project-welcome-hint">
                    {t("welcomeHint")}
                  </FieldDescription>
                  <p
                    className="shrink-0 text-xs text-muted-foreground tabular-nums"
                    id="new-project-welcome-count"
                  >
                    {t("charactersLeft", { count: charactersLeft })}
                  </p>
                </div>
                <FieldError
                  data-error-type={errors.welcomeMessage?.type}
                  data-testid="new-project-welcome-error"
                  errors={[errors.welcomeMessage]}
                  id="new-project-welcome-error"
                />
              </Field>
            </FieldGroup>
          </div>

          {submitError ? (
            <div
              className="px-6 pb-4 text-sm text-destructive"
              data-testid="create-project-error"
              role="alert"
            >
              {submitError}
            </div>
          ) : null}

          <DialogFooter variant="form">
            <p className="text-xs text-muted-foreground">{t("requiredHint")}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <DialogClose
                render={
                  <Button
                    data-testid="cancel-new-project"
                    disabled={isSubmitting}
                    type="button"
                    variant="outline"
                  />
                }
              >
                {t("cancel")}
              </DialogClose>
              <Button
                data-testid="create-project"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                {isSubmitting ? t("creating") : t("submit")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
