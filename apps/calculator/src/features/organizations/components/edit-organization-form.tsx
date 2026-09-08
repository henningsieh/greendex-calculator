"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { findAvailableSlug } from "@/features/organizations/utils";
import { EditOrganizationFormSchema } from "@/features/organizations/validation-schemas";
import { authClient } from "@/lib/better-auth/auth-client";
import { orpcQuery } from "@/lib/orpc/orpc";

/**
 * Renders a form to edit the active organization's name and applies updates (adjusting the slug when the name changes).
 *
 * The component loads the active organization, populates the form, submits updated name and slug to the backend, shows success or error toasts, and invalidates related queries to refresh data after a successful update.
 *
 * @returns The React element for the edit organization form, or a skeleton placeholder while the organization data is loading.
 */
export function EditOrganizationForm() {
  const queryClient = useQueryClient();
  const { data: organization } = useSuspenseQuery(
    orpcQuery.organizations.getActive.queryOptions(),
  );

  const form = useForm<z.infer<typeof EditOrganizationFormSchema>>({
    resolver: zodResolver(EditOrganizationFormSchema),
    defaultValues: {
      name: organization?.name || "",
    },
  });

  async function onSubmit(data: z.infer<typeof EditOrganizationFormSchema>) {
    if (!organization) {
      toast.error("No organization found");
      return;
    }

    try {
      let slugToUse = organization.slug;

      // If name changed, find a new available slug
      if (data.name !== organization.name) {
        slugToUse = await findAvailableSlug(data.name);
      }

      await authClient.organization.update(
        {
          organizationId: organization.id,
          data: {
            name: data.name,
            slug: slugToUse,
          },
        },
        {
          onError: (ctx) => {
            toast.error(ctx.error.message || "Failed to update organization");
          },
          onSuccess: () => {
            toast.success("Organization updated successfully!");
            void queryClient.invalidateQueries(
              orpcQuery.organizations.list.queryOptions(),
            );
            void queryClient.invalidateQueries(
              orpcQuery.organizations.getActive.queryOptions(),
            );
          },
        },
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update organization";
      toast.error(errorMessage);
    }
  }

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    void form.handleSubmit(onSubmit)(e);
  };

  if (!organization) {
    return <EditOrganizationFormSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Organization</CardTitle>
        <CardDescription>Update your organization's name.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Organization"
                      {...field}
                      disabled={form.formState.isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              disabled={form.formState.isSubmitting}
              onClick={handleSubmit}
              type="button"
              variant="secondary"
            >
              {form.formState.isSubmitting
                ? "Updating..."
                : "Update Organization"}
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}

export function EditOrganizationFormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-6 w-40" />
        </CardTitle>
        <CardDescription>
          <Skeleton className="h-4 w-64" />
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>

          <Skeleton className="h-10 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}
