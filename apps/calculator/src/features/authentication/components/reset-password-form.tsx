"use client";

import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockIcon } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { LOGIN_PATH } from "@/app/routes";
import FormField from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/better-auth/auth-client";
import { Link, useRouter } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

interface ResetPasswordFormProps extends React.ComponentProps<"div"> {
  token: string;
}

export function ResetPasswordForm({
  token,
  className,
  ...props
}: ResetPasswordFormProps) {
  const router = useRouter();
  const t = useTranslations("authentication");

  const formSchema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(6, t("validation.passwordMinLength")),
          confirmPassword: z
            .string()
            .min(1, t("validation.passwordConfirmRequired")),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t("validation.passwordsNoMatch"),
          path: ["confirmPassword"],
        }),
    [t],
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    await authClient.resetPassword(
      {
        newPassword: data.password,
        token,
      },
      {
        onSuccess: () => {
          toast.success(t("resetPassword.resetSuccess"));
          router.push(LOGIN_PATH);
        },
        onError: (ctx) => {
          toast.error(ctx.error.message || t("resetPassword.resetFailed"));
        },
      },
    );
  };

  return (
    <Card className="p-4 sm:p-8 md:p-12">
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <CardHeader className="flex flex-col items-center gap-4 px-0 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <LockIcon className="size-8 text-primary" />
          </div>
          <CardTitle className="space-y-2">
            <h1 className="text-2xl font-bold">{t("resetPassword.title")}</h1>
          </CardTitle>
          <CardDescription>{t("resetPassword.description")}</CardDescription>
        </CardHeader>

        <CardContent className="px-0">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup className="gap-4">
              <FormField
                control={form.control}
                description={t("resetPassword.newPasswordDescription")}
                id="password"
                inputProps={{
                  disabled: form.formState.isSubmitting,
                }}
                label={t("resetPassword.newPassword")}
                name="password"
                type="password"
              />
              <FormField
                control={form.control}
                description={t("resetPassword.confirmPasswordDescription")}
                id="confirm-password"
                inputProps={{
                  disabled: form.formState.isSubmitting,
                }}
                label={t("resetPassword.confirmPassword")}
                name="confirmPassword"
                type="password"
              />

              <Button
                className="mt-2"
                disabled={form.formState.isSubmitting}
                type="submit"
                variant="default"
              >
                {form.formState.isSubmitting
                  ? t("resetPassword.resetting")
                  : t("resetPassword.resetPasswordButton")}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>

        <CardFooter className="px-0">
          <div className="w-full text-center">
            <Button asChild variant="link">
              <Link href={LOGIN_PATH}>{t("common.backToLogin")}</Link>
            </Button>
          </div>
        </CardFooter>
      </div>
    </Card>
  );
}
