"use client";

import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { LinkIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { type z } from "zod";

import { EntityCombobox } from "@/components/entity-combobox";
import {
  ErrorPresentation,
  FieldErrorMessage,
} from "@/components/error-presentation/error-presentation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import type { OrganizationOption } from "@/features/organizations/validation-schemas";
import { AssignProjectPartnershipInputSchema } from "@/features/partnerships/validation-schemas";
import type { HostedProjectOption } from "@/features/projects/validation-schemas";
import { orpc } from "@/lib/orpc/orpc";

import { invalidatePartnershipProjectData } from "./invalidate-partnership-data";

type Values = z.infer<typeof AssignProjectPartnershipInputSchema>;

export function AssignOrganizationDialog({
  projects,
  organizations,
}: {
  projects: readonly HostedProjectOption[];
  organizations: readonly OrganizationOption[];
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("partnerships");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<React.ReactNode>(null);
  const form = useForm<Values>({
    resolver: zodResolver(AssignProjectPartnershipInputSchema),
    defaultValues: { projectId: "", organizationId: "" },
    mode: "onTouched",
  });
  const pending = form.formState.isSubmitting;

  async function assign(values: Values) {
    setError(null);
    try {
      await orpc.projectPartnerships.assign(values);
      await invalidatePartnershipProjectData(queryClient);
      setOpen(false);
      form.reset();
    } catch (cause) {
      setError(<ErrorPresentation error={cause} />);
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) setError(null);
      }}
      open={open}
    >
      <DialogTrigger
        data-testid="assign-organization"
        render={<Button type="button" />}
      >
        {t("manager.assignExisting")}
      </DialogTrigger>
      <DialogContent
        data-testid="organization-assignment"
        className="sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{t("manager.assignExisting")}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-5"
          onSubmit={form.handleSubmit(assign)}
        >
          <Controller
            control={form.control}
            name="projectId"
            render={({ field, fieldState }) => (
              <Field
                data-testid="hosted-project-picker"
                data-invalid={fieldState.invalid}
              >
                <FieldLabel htmlFor="assign-project">
                  {t("manager.hostedProject")}
                </FieldLabel>
                <EntityCombobox
                  id="assign-project"
                  label={t("manager.hostedProject")}
                  value={field.value}
                  onChange={field.onChange}
                  preload={projects}
                  disabled={pending}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? "assign-project-error" : undefined
                  }
                />
                {fieldState.invalid && (
                  <FieldError id="assign-project-error">
                    <FieldErrorMessage message={fieldState.error?.message} />
                  </FieldError>
                )}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="organizationId"
            render={({ field, fieldState }) => (
              <Field
                data-testid="partner-organization-picker"
                data-invalid={fieldState.invalid}
              >
                <FieldLabel htmlFor="assign-organization">
                  {t("manager.partnerOrganization")}
                </FieldLabel>
                <EntityCombobox
                  id="assign-organization"
                  label={t("manager.partnerOrganization")}
                  value={field.value}
                  onChange={field.onChange}
                  preload={organizations}
                  disabled={pending}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? "assign-organization-error" : undefined
                  }
                />
                {fieldState.invalid && (
                  <FieldError id="assign-organization-error">
                    <FieldErrorMessage message={fieldState.error?.message} />
                  </FieldError>
                )}
              </Field>
            )}
          />
          {error && <div role="alert">{error}</div>}
          <DialogFooter className="flex-row justify-end">
            <DialogClose
              render={
                <Button disabled={pending} type="button" variant="outline" />
              }
            >
              {t("manager.cancel")}
            </DialogClose>
            <Button
              data-testid="assign-partnership"
              disabled={pending}
              type="submit"
            >
              <LinkIcon aria-hidden="true" />
              {pending ? t("manager.assigning") : t("manager.assign")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
