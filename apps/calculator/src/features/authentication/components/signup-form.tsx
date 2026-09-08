"use client";

import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlusIcon } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DASHBOARD_PATH, LOGIN_PATH } from "@/app/routes";
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldSeparator,
} from "@/components/ui/field";
import { env } from "@/env";
import { normalizeRedirectPath } from "@/features/authentication/components/auth-flow-layout";
import { SocialButtons } from "@/features/authentication/components/social-buttons";
import { authClient } from "@/lib/better-auth/auth-client";
import { Link, useRouter } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Render a signup form that validates input and registers a new user via email.
 *
 * The form validates name, email, password, and password confirmation, shows
 * success or error toasts, and redirects the user to a verification page after
 * successful signup. The signup request includes a callback URL derived from
 * the app base URL combined with `nextPageUrl`.
 *
 * @param nextPageUrl - Optional path or paths to redirect to after authentication; used to construct the signup callback URL. If omitted, the dashboard path is used.
 * @returns A JSX element representing the signup form UI.
 */
export function SignupForm({
  className,
  nextPageUrl,
  ...props
}: React.ComponentProps<"form"> & {
  nextPageUrl?: string | string[];
}) {
  const t = useTranslations("authentication");
  const router = useRouter();

  const formSchema = useMemo(
    () =>
      z
        .object({
          name: z.string().min(1, t("validation.fullNameRequired")),
          email: z.email(t("validation.emailInvalid")),
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
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const finalRedirect =
    env.NEXT_PUBLIC_BASE_URL + normalizeRedirectPath(nextPageUrl, DASHBOARD_PATH);

  console.debug("SignupForm onSubmit finalRedirect:", finalRedirect);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    await authClient.signUp.email(
      {
        email: data.email,
        password: data.password,
        name: data.name,
        callbackURL: finalRedirect,
      },
      {
        onError: (c) => {
          toast.error(c.error.message || t("common.failedCreate"));
        },
        onSuccess: () => {
          toast.success("Please check your email to verify your account.");
          // Redirect to verify email page after successful signup
          router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
        },
      },
    );
  };

  return (
    <Card className="p-3 sm:p-5 md:p-6">
      <form
        className={cn("flex flex-col gap-4", className)}
        {...props}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <CardHeader className="flex flex-col items-center gap-3 px-0 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
            <UserPlusIcon className="size-7 text-primary" />
          </div>
          <CardTitle className="space-y-1">
            <h1 className="text-xl font-bold">{t("signup.title")}</h1>
          </CardTitle>
          <CardDescription className="text-sm">
            {t("signup.description")}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-0">
          <FieldGroup className="gap-3">
            <FormField
              control={form.control}
              id="name"
              inputProps={{
                disabled: form.formState.isSubmitting,
              }}
              label={t("signup.fullName")}
              name="name"
              placeholder={t("common.fullNamePlaceholder")}
              type="text"
            />
            <FormField
              control={form.control}
              description={t("signup.emailDescription")}
              id="email"
              inputProps={{
                disabled: form.formState.isSubmitting,
              }}
              label={t("signup.email")}
              name="email"
              placeholder={t("common.emailPlaceholder")}
              type="email"
            />
            <FormField
              control={form.control}
              description={t("signup.passwordDescription")}
              id="password"
              inputProps={{
                disabled: form.formState.isSubmitting,
              }}
              label={t("signup.password")}
              name="password"
              type="password"
            />
            <FormField
              control={form.control}
              description={t("signup.confirmPasswordDescription")}
              id="confirm-password"
              inputProps={{
                disabled: form.formState.isSubmitting,
              }}
              label={t("signup.confirmPassword")}
              name="confirmPassword"
              type="password"
            />

            <Button
              className="mt-2"
              disabled={form.formState.isSubmitting}
              type="submit"
            >
              {form.formState.isSubmitting
                ? t("common.signingUp")
                : t("signup.signUpButton")}
            </Button>
          </FieldGroup>
        </CardContent>

        <CardFooter className="px-0">
          <div className="w-full">
            <Field>
              <FieldDescription className="px-6 text-center font-bold">
                {t("signup.footer.haveAccount")}
                <Button asChild className="px-0 pl-1" variant="link">
                  <Link href={LOGIN_PATH}>{t("signup.footer.signIn")}</Link>
                </Button>
              </FieldDescription>

              <FieldSeparator className="my-4 font-bold">
                {t("common.orContinueWith")}
              </FieldSeparator>

              <SocialButtons disabled={form.formState.isSubmitting} />
            </Field>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
