"use client";

import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogInIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  DASHBOARD_PATH,
  FORGOT_PASSWORD_PATH,
  SIGNUP_PATH,
  VERIFY_EMAIL_PATH,
} from "@/app/routes";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/env";
import { normalizeRedirectPath } from "@/features/authentication/components/auth-flow-layout";
import { LastUsedBadge } from "@/features/authentication/components/last-used-badge";
import { SocialButtons } from "@/features/authentication/components/social-buttons";
import { authClient } from "@/lib/better-auth/auth-client";
import { Link, useRouter } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Render a login form with password and magic-link methods, social sign-in buttons, and redirect handling.
 *
 * The component displays two tabs (password and magic link), validates input, initiates sign-in flows,
 * and computes a post-login callback URL from `nextPageUrl`. It reads the last-used login method on mount
 * and highlights the corresponding tab. Sign-in results produce toast notifications; if an email sign-in
 * fails due to an unverified email, the user is redirected to the email verification page.
 *
 * @param className - Optional additional CSS class names applied to the container.
 * @param nextPageUrl - Optional path or array of path segments used to compute the post-login redirect; if omitted, the dashboard path is used.
 * @returns The login form React element.
 */
export function LoginForm({
  className,
  nextPageUrl,
  ...props
}: React.ComponentProps<"div"> & {
  nextPageUrl?: string | string[];
}) {
  const [lastLoginMethod, setLastLoginMethod] = useState<string | null>(null);

  const router = useRouter();
  const t = useTranslations("authentication");

  // append the callbackUrl to the env
  const finalRedirect = normalizeRedirectPath(nextPageUrl, DASHBOARD_PATH);
  const callbackURL = env.NEXT_PUBLIC_BASE_URL + finalRedirect;

  // Get last login method on component mount
  useEffect(() => {
    const method = authClient.getLastUsedLoginMethod();
    setLastLoginMethod(method);
  }, []);

  const credentialsSchema = useMemo(
    () =>
      z.object({
        email: z.email(t("validation.emailInvalid")),
        password: z.string().min(6, t("validation.passwordRequired")),
      }),
    [t],
  );
  const magicLinkSchema = useMemo(
    () =>
      z.object({
        email: z.email(t("validation.emailInvalid")),
      }),
    [t],
  );

  const form = useForm<z.infer<typeof credentialsSchema>>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const magicLinkForm = useForm<z.infer<typeof magicLinkSchema>>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof credentialsSchema>) => {
    await authClient.signIn.email(
      {
        email: data.email,
        password: data.password,
        callbackURL,
      },
      {
        onError: (c) => {
          if (c.error.code === "EMAIL_NOT_VERIFIED") {
            toast.error(t("login.verifyEmail"));
            router.push(
              `${VERIFY_EMAIL_PATH}?email=${encodeURIComponent(data.email)}`,
            );
            return;
          }
          toast.error(c.error.message || t("common.failedSignIn"));
        },
      },
    );
  };

  const onMagicLinkSubmit = async (data: z.infer<typeof magicLinkSchema>) => {
    await authClient.signIn.magicLink(
      {
        email: data.email,
        callbackURL,
      },
      {
        onSuccess: () => {
          toast.success(t("login.magicLinkSent"));
        },
        onError: (c) => {
          toast.error(c.error.message || t("login.failedMagicLink"));
        },
      },
    );
  };

  return (
    <Card className="p-3 sm:p-5 md:p-6">
      <div className={cn("flex flex-col gap-4", className)} {...props}>
        <CardHeader className="flex flex-col items-center gap-3 px-0 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
            <LogInIcon className="size-7 text-primary" />
          </div>
          <CardTitle className="space-y-1">
            <h1 className="text-xl font-bold">{t("login.title")}</h1>
          </CardTitle>
          <CardDescription>{t("login.description")}</CardDescription>
        </CardHeader>

        <CardContent className="px-0">
          {/* Badges are positioned absolute within the relative containers in the top right */}
          <Tabs className="w-full space-y-5" defaultValue="password">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger className="relative" value="password">
                {t("login.tabs.password")}
                {(lastLoginMethod === "email" ||
                  lastLoginMethod === "credential") && (
                  <LastUsedBadge className="-bottom-7.5 left-1" />
                )}
              </TabsTrigger>
              <TabsTrigger className="relative" value="magic-link">
                {t("login.tabs.magicLink")}
                {lastLoginMethod === "magic-link" && (
                  <LastUsedBadge className="-bottom-7.5 left-1" />
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="password">
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <FieldGroup className="">
                  <FormField
                    control={form.control}
                    id="email"
                    inputProps={{
                      disabled: form.formState.isSubmitting,
                    }}
                    label={t("login.email")}
                    name="email"
                    placeholder={t("common.emailPlaceholder")}
                    type="email"
                  />
                  <FormField
                    control={form.control}
                    id="password"
                    inputProps={{
                      disabled: form.formState.isSubmitting,
                    }}
                    label={t("login.password")}
                    name="password"
                    rightLabel={
                      <Button asChild variant="link">
                        <Link
                          className="ml-auto text-sm underline-offset-4 hover:underline"
                          href={FORGOT_PASSWORD_PATH}
                        >
                          {t("login.forgotPassword")}
                        </Link>
                      </Button>
                    }
                    type="password"
                  />

                  <Button
                    className="mt-2"
                    disabled={form.formState.isSubmitting}
                    type="submit"
                    variant="default"
                  >
                    {form.formState.isSubmitting
                      ? t("login.signingIn")
                      : t("login.loginButton")}
                  </Button>
                </FieldGroup>
              </form>
            </TabsContent>
            <TabsContent value="magic-link">
              <form onSubmit={magicLinkForm.handleSubmit(onMagicLinkSubmit)}>
                <FieldGroup className="gap-4">
                  <FormField
                    control={magicLinkForm.control}
                    id="magic-email"
                    inputProps={{
                      disabled: magicLinkForm.formState.isSubmitting,
                    }}
                    label={t("login.email")}
                    name="email"
                    placeholder={t("common.emailPlaceholder")}
                    type="email"
                  />

                  <Button
                    className="mt-2"
                    disabled={magicLinkForm.formState.isSubmitting}
                    type="submit"
                    variant="default"
                  >
                    {magicLinkForm.formState.isSubmitting
                      ? t("login.sending")
                      : t("login.sendMagicLink")}
                  </Button>
                </FieldGroup>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="px-0">
          <div className="w-full">
            <Field>
              <FieldDescription className="px-6 text-center font-bold">
                {t("login.footer.noAccount")}
                {(() => {
                  let signupHref = `${SIGNUP_PATH}`;
                  if (nextPageUrl) {
                    const normalized = normalizeRedirectPath(
                      nextPageUrl,
                      DASHBOARD_PATH,
                    );
                    signupHref += `?nextPageUrl=${encodeURIComponent(normalized)}`;
                  }
                  return (
                    <Button
                      asChild
                      /* eslint-disable-next-line shadcn/no-restyle -- Inline auth link alignment is intentional. */
                      className="pl-1"
                      variant="link"
                    >
                      <Link href={signupHref}>{t("login.footer.signUp")}</Link>
                    </Button>
                  );
                })()}
              </FieldDescription>

              <FieldSeparator className="my-4 font-bold">
                {t("common.orContinueWith")}
              </FieldSeparator>

              <SocialButtons
                callbackUrl={callbackURL}
                disabled={form.formState.isSubmitting}
                lastLoginMethod={lastLoginMethod}
              />
            </Field>
          </div>
        </CardFooter>
      </div>
    </Card>
  );
}
