"use client";

import { Dialog } from "@base-ui/react/dialog";
import { EU_COUNTRIES } from "@greendex/config/eu-countries";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ProjectCreateInputSchema } from "@/features/projects/validation-schemas";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc } from "@/lib/orpc/orpc";

type Details = z.input<typeof ProjectCreateInputSchema>;

export function CreateProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
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
      setSubmitError(getORPCRequestErrorMessage(error).text);
    }
  });

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Trigger render={<Button type="button" />}>
        New project
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" />
        <Dialog.Viewport className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Popup className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background p-6 shadow-xl outline-none">
            <Dialog.Title className="font-heading text-2xl font-semibold">
              New project
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Add the Project details. Travel can be added later with Claims.
            </Dialog.Description>
            <form className="mt-6" noValidate onSubmit={submit}>
              <FieldGroup>
                <Field data-invalid={!!errors.name}>
                  <FieldLabel htmlFor="new-project-name">Name</FieldLabel>
                  <Input
                    aria-invalid={!!errors.name}
                    id="new-project-name"
                    {...register("name")}
                  />
                  {errors.name && <FieldError>{errors.name.message}</FieldError>}
                </Field>
                <Field data-invalid={!!errors.startDate}>
                  <FieldLabel htmlFor="new-project-start">Start date</FieldLabel>
                  <Input
                    aria-invalid={!!errors.startDate}
                    id="new-project-start"
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
                  <FieldLabel htmlFor="new-project-end">End date</FieldLabel>
                  <Input
                    aria-invalid={!!errors.endDate}
                    id="new-project-end"
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
                  <FieldLabel htmlFor="new-project-location">Location</FieldLabel>
                  <Input
                    aria-invalid={!!errors.location}
                    id="new-project-location"
                    {...register("location")}
                  />
                  {errors.location && (
                    <FieldError>{errors.location.message}</FieldError>
                  )}
                </Field>
                <Field data-invalid={!!errors.country}>
                  <FieldLabel htmlFor="new-project-country">Country</FieldLabel>
                  <select
                    aria-invalid={!!errors.country}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    id="new-project-country"
                    defaultValue=""
                    {...register("country")}
                  >
                    <option disabled value="">
                      Select an EU country
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
                    Welcome message (optional)
                  </FieldLabel>
                  <textarea
                    aria-invalid={!!errors.welcomeMessage}
                    className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    id="new-project-welcome"
                    {...register("welcomeMessage")}
                  />
                  {errors.welcomeMessage && (
                    <FieldError>{errors.welcomeMessage.message}</FieldError>
                  )}
                </Field>
                {submitError && (
                  <p role="alert" className="text-sm text-destructive">
                    {submitError}
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <Dialog.Close
                    render={<Button type="button" variant="outline" />}
                  >
                    Cancel
                  </Dialog.Close>
                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting ? "Creating…" : "Create project"}
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
