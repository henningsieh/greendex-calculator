"use client";

import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlusIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import InputField from "@/components/form-field";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEMBER_ROLES, type MemberRole } from "@/features/organizations/types";
import { InviteFormSchema } from "@/features/organizations/validation-schemas";
import { authClient } from "@/lib/better-auth/auth-client";
import { orpcQuery } from "@/lib/orpc/orpc";

interface Props {
  organizationId: string;
  allowedRoles?: MemberRole[];
  onSuccess?: () => void;
}

export function InviteProjectCoordinatorDialog({
  organizationId,
  allowedRoles = Object.values(MEMBER_ROLES),
  onSuccess,
}: Props) {
  const queryClient = useQueryClient();
  const tRoles = useTranslations("organization.roles");
  const tInvite = useTranslations("organization.team.invite");
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof InviteFormSchema>>({
    resolver: zodResolver(InviteFormSchema),
    defaultValues: {
      email: "",
      name: "",
      role: MEMBER_ROLES.ProjectCoordinator,
    },
  });

  async function onSubmit(data: z.infer<typeof InviteFormSchema>) {
    try {
      await authClient.organization.inviteMember(
        {
          organizationId,
          email: data.email,
          role: data.role as MemberRole,
        },
        {
          onError: (ctx) => {
            toast.error(ctx.error.message || "Failed to send invitation");
          },
          onSuccess: async () => {
            toast.success(tInvite("successToast"));
            setOpen(false);
            form.reset();
            await queryClient.invalidateQueries(
              orpcQuery.members.search.queryOptions({
                input: {
                  organizationId,
                  filters: {
                    roles: [
                      MEMBER_ROLES.OrganizationAdministrator,
                      MEMBER_ROLES.ProjectCoordinator,
                    ],
                  },
                },
              }),
            );

            onSuccess?.();
          },
        },
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to send invitation";
      toast.error(message);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="" variant="default">
          <UserPlusIcon className="size-5" />
          {tInvite("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle
            /* eslint-disable-next-line shadcn/no-restyle -- Dialog title is intentionally prominent here. */
            className="text-2xl"
          >
            {tInvite("title")}
          </DialogTitle>
          <DialogDescription>{tInvite("description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <InputField
                control={form.control}
                description={tInvite("emailDescription")}
                id="invite-email"
                inputProps={{
                  disabled: form.formState.isSubmitting,
                }}
                label={tInvite("emailLabel")}
                name="email"
                placeholder="name@domain.com"
                type="email"
              />

              <InputField
                control={form.control}
                id="invite-name"
                inputProps={{
                  disabled: form.formState.isSubmitting,
                }}
                label={tInvite("nameLabel")}
                name="name"
                placeholder="Jane Doe"
                type="text"
              />

              <FormField<z.infer<typeof InviteFormSchema>, "role">
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tInvite("roleLabel")}</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="invite-role" size="default">
                          <SelectValue placeholder={tInvite("rolePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {tRoles(role)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{tInvite("cancelButton")}</Button>
                </DialogClose>
                <Button disabled={form.formState.isSubmitting} type="submit">
                  {form.formState.isSubmitting
                    ? tInvite("sendingButton")
                    : tInvite("sendButton")}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
