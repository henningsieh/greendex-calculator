"use client";

import { Dialog } from "@base-ui/react/dialog";
import { EU_COUNTRIES } from "@greendex/config/eu-countries";
import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ProjectCreateInputSchema } from "@/features/projects/validation-schemas";
import { orpc } from "@/lib/orpc/orpc";

type Details = z.input<typeof ProjectCreateInputSchema>;

export function CreateProjectDialog() {
  const router = useRouter();
  const t = useTranslations("projects.create");
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<React.ReactNode>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<Details>({
    resolver: zodResolver(ProjectCreateInputSchema),
    defaultValues: { name: "", location: "", welcomeMessage: "" },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(undefined);
    try {
      const { id } = await orpc.projects.create(values);
      setOpen(false);
      reset();
      router.push(`/projects/${encodeURIComponent(id)}`);
    } catch (error) {
      setSubmitError(<ErrorPresentation error={error} />);
    }
  });

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Trigger data-testid="new-project" render={<Button type="button" />}>
        {t("title")}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" />
        <Dialog.Viewport className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Popup
            data-testid="create-project-dialog"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background p-6 shadow-xl outline-none"
          >
            <Dialog.Title className="font-heading text-2xl font-semibold">
              {t("title")}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {t("description")}
            </Dialog.Description>
            <form className="mt-6" noValidate onSubmit={submit}>
              <FieldGroup>
                <Field data-invalid={!!errors.name}>
                  <FieldLabel htmlFor="new-project-name">{t("name")}</FieldLabel>
                  <Input
                    aria-invalid={!!errors.name}
                    id="new-project-name"
                    data-testid="new-project-name"
                    {...register("name")}
                  />
                  {errors.name && <FieldError>{errors.name.message}</FieldError>}
                </Field>
                <Field data-invalid={!!errors.startDate}>
                  <FieldLabel htmlFor="new-project-start">
                    {t("startDate")}
                  </FieldLabel>
                  <Input
                    aria-invalid={!!errors.startDate}
                    id="new-project-start"
                    data-testid="new-project-start"
                    type="date"
                    {...register("startDate", {
                      setValueAs: (value: string) =>
                        value ? new Date(`${value}T00:00:00.000Z`) : undefined,
                    })}
                  />
                  {errors.startDate && (
                    <FieldError>{errors.startDate.message}</FieldError>
                  )}
                </Field>
                <Field data-invalid={!!errors.endDate}>
                  <FieldLabel htmlFor="new-project-end">
                    {t("endDate")}
                  </FieldLabel>
                  <Input
                    aria-invalid={!!errors.endDate}
                    id="new-project-end"
                    data-testid="new-project-end"
                    type="date"
                    {...register("endDate", {
                      setValueAs: (value: string) =>
                        value ? new Date(`${value}T00:00:00.000Z`) : undefined,
                    })}
                  />
                  {errors.endDate && (
                    <FieldError>{errors.endDate.message}</FieldError>
                  )}
                </Field>
                <Field data-invalid={!!errors.location}>
                  <FieldLabel htmlFor="new-project-location">
                    {t("location")}
                  </FieldLabel>
                  <Input
                    aria-invalid={!!errors.location}
                    id="new-project-location"
                    data-testid="new-project-location"
                    {...register("location")}
                  />
                  {errors.location && (
                    <FieldError>{errors.location.message}</FieldError>
                  )}
                </Field>
                <Field data-invalid={!!errors.country}>
                  <FieldLabel htmlFor="new-project-country">
                    {t("country")}
                  </FieldLabel>
                  <select
                    aria-invalid={!!errors.country}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    id="new-project-country"
                    data-testid="new-project-country"
                    defaultValue=""
                    {...register("country")}
                  >
                    <option disabled value="">
                      {t("countryPlaceholder")}
                    </option>
                    {EU_COUNTRIES.map(({ code }) => (
                      <option key={code} value={code}>
                        {new Intl.DisplayNames(["en"], { type: "region" }).of(
                          code,
                        )}
                      </option>
                    ))}
                  </select>
                  {errors.country && (
                    <FieldError>{errors.country.message}</FieldError>
                  )}
                </Field>
                <Field data-invalid={!!errors.welcomeMessage}>
                  <FieldLabel htmlFor="new-project-welcome">
                    {t("welcomeMessage")}
                  </FieldLabel>
                  <textarea
                    aria-invalid={!!errors.welcomeMessage}
                    className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    id="new-project-welcome"
                    data-testid="new-project-welcome"
                    {...register("welcomeMessage")}
                  />
                  {errors.welcomeMessage && (
                    <FieldError>{errors.welcomeMessage.message}</FieldError>
                  )}
                </Field>
                {submitError && (
                  <div role="alert" className="text-sm text-destructive">
                    {submitError}
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <Dialog.Close
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        data-testid="cancel-new-project"
                      />
                    }
                  >
                    {t("cancel")}
                  </Dialog.Close>
                  <Button
                    data-testid="create-project"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? t("creating") : t("submit")}
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
