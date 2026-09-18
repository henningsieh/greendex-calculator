"use client";

import { useTranslations } from "@greendex/i18n/client";
import { MailIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LOGIN_PATH, SIGNUP_PATH } from "@/app/routes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/better-auth/auth-client";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Render a verification-email UI and manage resend actions for the email address passed in the URL query.
 *
 * This component reads the "email" query parameter and displays instructions and a resend button.
 * It enforces a 60-second cooldown between resend attempts, shows success and error toasts, and
 * calls the authentication client to send verification emails with a callback to LOGIN_PATH.
 *
 * @param props - Standard div props spread onto the root Card element (accepts `className` and other div attributes)
 */
export function VerifyEmailContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [isResending, setIsResending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const t = useTranslations("authentication.verifyEmail");

  // 60 second cooldown
  const COOLDOWN_SECONDS = 60;
  const canResend = countdown === 0;

  useEffect(() => {
    if (!lastSentAt) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastSentAt.getTime()) / 1000);
      const remaining = Math.max(0, COOLDOWN_SECONDS - elapsed);
      setCountdown(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastSentAt]);

  const handleResendEmail = async () => {
    if (!email) {
      toast.error(t("toast.emailRequired"));
      return;
    }

    if (!canResend) {
      toast.error(t("toast.waitBeforeResend", { countdown }));
      return;
    }

    setIsResending(true);
    try {
      await authClient.sendVerificationEmail({
        email,
        callbackURL: LOGIN_PATH,
      });

      setLastSentAt(new Date());
      setCountdown(COOLDOWN_SECONDS);
      toast.success(t("toast.success"));
    } catch (error: unknown) {
      console.error("Failed to resend verification email:", error);
      const message = error instanceof Error ? error.message : t("toast.error");
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  if (!email) {
    return (
      <Card className={cn("", className)} {...props}>
        <CardHeader className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <MailIcon className="size-8 text-destructive" />
          </div>
          <CardTitle>
            <h1 className="text-2xl font-bold">{t("emailRequired.title")}</h1>
          </CardTitle>
          <CardDescription>{t("emailRequired.description")}</CardDescription>
        </CardHeader>

        <CardContent>
          <FieldGroup>
            <div />
          </FieldGroup>
        </CardContent>

        <CardFooter>
          <Field className="w-full">
            <Link href={SIGNUP_PATH}>
              <Button className="w-full" variant="default">
                {t("emailRequired.goToSignUp")}
              </Button>
            </Link>
          </Field>
        </CardFooter>
      </Card>
    );
  }

  // Compute resend button label to avoid nested ternary
  let resendButtonLabel: string;
  if (isResending) {
    resendButtonLabel = t("resend.sending");
  } else if (canResend) {
    resendButtonLabel = t("resend.button");
  } else {
    resendButtonLabel = t("resend.disabled", { countdown });
  }

  return (
    <Card className={cn("", className)} {...props}>
      <CardHeader className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <MailIcon className="size-8 text-primary" />
        </div>
        <CardTitle>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </CardTitle>
        {/* eslint-disable-next-line shadcn/no-restyle -- Verification copy intentionally uses the brand color. */}
        <CardDescription className="text-primary">
          {t("description")}
          <div className="mt-1 font-bold italic">{email}</div>
        </CardDescription>
      </CardHeader>

      <CardContent>
        <FieldGroup className="gap-6">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="space-y-2 text-center text-sm">
              <p className="font-medium">{t("steps.title")}</p>
              <ol className="space-y-1 text-left text-muted-foreground">
                <li>1. {t("steps.checkInbox")}</li>
                <li>2. {t("steps.clickLink")}</li>
                <li>3. {t("steps.autoSignIn")}</li>
              </ol>
            </div>
          </div>

          <div className="space-y-3">
            <FieldDescription className="text-center">
              <strong>{t("important.label")}</strong> {t("important.text")}
            </FieldDescription>
          </div>
        </FieldGroup>
      </CardContent>

      <CardFooter>
        <div className="w-full">
          <Field>
            <Button
              className="w-full"
              disabled={isResending || !canResend}
              onClick={handleResendEmail}
              variant="default"
            >
              {resendButtonLabel}
            </Button>
            <FieldDescription className="px-6 text-center font-bold">
              {t("resend.footer")}
            </FieldDescription>
          </Field>
        </div>
      </CardFooter>
    </Card>
  );
}
