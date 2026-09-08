"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { EditNameValues } from "@/features/user-settings/types";
import { EditNameSchema } from "@/features/user-settings/validation-schemas";
import { authClient } from "@/lib/auth-client";

type EditNameFormProps = {
  email: string;
  name: string;
};

export function EditNameForm({ email, name }: EditNameFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const form = useForm<EditNameValues>({
    resolver: zodResolver(EditNameSchema),
    defaultValues: { name },
  });

  async function saveName(values: EditNameValues) {
    setError(undefined);
    setNotice(undefined);

    try {
      const result = await authClient.updateUser({ name: values.name });

      if (result.error) {
        setError(result.error.message ?? "Your name could not be updated.");
        return;
      }

      form.reset(values);
      setNotice("Your name has been updated.");
      router.refresh();
    } catch {
      setError("Your name could not be updated. Try again.");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(saveName)}>
      <FieldGroup className="max-w-lg gap-6">
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Name</FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                autoComplete="name"
                disabled={form.formState.isSubmitting}
                id={field.name}
                onChange={(event) => {
                  setError(undefined);
                  setNotice(undefined);
                  field.onChange(event);
                }}
              />
              <FieldDescription>
                This name appears in the navigation and across shared Project
                work.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Field>
          <FieldLabel htmlFor="account-email">Email address</FieldLabel>
          <Input disabled id="account-email" type="email" value={email} />
          <FieldDescription>
            Email changes are not available in Cost Tracker yet.
          </FieldDescription>
        </Field>

        {error && <FieldError>{error}</FieldError>}
        {notice && (
          <output className="text-sm font-medium" aria-live="polite">
            {notice}
          </output>
        )}

        <Button
          className="w-fit"
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
          type="submit"
        >
          {form.formState.isSubmitting && (
            <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
          )}
          {form.formState.isSubmitting ? "Saving name" : "Save name"}
        </Button>
      </FieldGroup>
    </form>
  );
}
