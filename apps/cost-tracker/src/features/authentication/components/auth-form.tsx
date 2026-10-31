"use client";

import { GoogleIcon } from "@greendex/auth/oauth-icons";
import { useTranslations } from "@greendex/i18n/client";
import { ArrowRightIcon, LoaderCircleIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useFormStatus } from "react-dom";

import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CheckInbox } from "@/features/authentication/components/check-inbox";
import { InvitationAcceptance } from "@/features/authentication/components/invitation-acceptance";
import { InvitationContext } from "@/features/authentication/components/invitation-context";
import type { OnboardingDecision } from "@/features/authentication/onboarding-decision";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
  returnTo?: string;
  entryContext?: OnboardingDecision["entryContext"];
  decision?: Extract<
    OnboardingDecision,
    { nextStep: "authenticate"; entryContext: "organization-invitation" }
  >;
};

export function AuthForm({
  mode,
  returnTo,
  entryContext = "direct",
  decision,
}: AuthFormProps) {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const heading = useRef<HTMLHeadingElement>(null);
  const [error, setError] = useState<React.ReactNode>();
  const [submittedEmail, setSubmittedEmail] = useState<string>();
  const [receipt, setReceipt] = useState<OnboardingDecision>();
  useEffect(() => {
    heading.current?.focus();
  }, [receipt]);
  const clearReceipt = useCallback(() => {
    setReceipt(undefined);
    setSubmittedEmail(undefined);
  }, []);
  const isSignIn = decision
    ? decision.availableActions[0].entry === "login"
    : mode === "sign-in";
  const destination = decision?.availableActions[0].returnTo ?? returnTo;

  function showError(error: unknown) {
    setError(<ErrorPresentation error={error} />);
  }

  async function submit(formData: FormData) {
    setError(undefined);
    setSubmittedEmail(undefined);

    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const name = String(formData.get("name"));

    try {
      if (isSignIn) {
        await orpc.authentication.signIn({ email, password });
      } else {
        const result = await orpc.authentication.signUp({
          name,
          email,
          password,
          returnTo: destination,
        });
        setReceipt(result.decision);
      }

      if (!isSignIn) {
        setSubmittedEmail(email);
        return;
      }

      // replace fetches the destination; a following refresh would start a second RSC request.
      router.replace((destination ?? "/projects") as Route);
    } catch (error) {
      showError(error);
    }
  }

  async function signInWithGoogle() {
    setError(undefined);

    try {
      const { url } = await orpc.authentication.startGoogleSignIn(
        destination ? { returnTo: destination } : {},
      );
      window.location.assign(url);
    } catch (error) {
      showError(error);
    }
  }

  if (receipt?.nextStep === "invitation-recovery")
    return (
      <InvitationAcceptance
        initialDecision={receipt}
        returnTo={receipt.returnTo}
        onAuthenticate={clearReceipt}
      />
    );
  if (receipt?.nextStep === "verify-email")
    return <CheckInbox email={receipt.email} decision={receipt} />;
  if (submittedEmail) return <CheckInbox email={submittedEmail} />;

  return (
    <div
      className={cn("w-full max-w-md", decision && "pb-24")}
      data-onboarding-state={decision ? "authenticate" : undefined}
    >
      <AuthEntryIntroduction
        decision={decision}
        entryContext={entryContext}
        isSignIn={isSignIn}
        heading={heading}
      />

      <form action={submit}>
        <FieldGroup className="gap-6">
          <Button
            data-testid="google-sign-in"
            onClick={signInWithGoogle}
            type="button"
            variant="outline"
          >
            <GoogleIcon data-icon="inline-start" />
            {t("auth.google")}
          </Button>

          <FieldSeparator>{t("auth.emailSeparator")}</FieldSeparator>

          <AuthCredentialFields isSignIn={isSignIn} error={error} />

          {decision ? (
            <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background px-5 py-3 lg:left-[45%]">
              <div className="mx-auto grid w-full max-w-md">
                <SubmitButton isSignIn={isSignIn} />
              </div>
            </div>
          ) : (
            <SubmitButton isSignIn={isSignIn} />
          )}
        </FieldGroup>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t(isSignIn ? "auth.newAccount" : "auth.existingAccount")}{" "}
        <Link
          data-testid="auth-account-navigation"
          className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href={`${isSignIn ? "/register" : "/login"}${destination ? `?next=${encodeURIComponent(destination)}` : ""}`}
        >
          {t(isSignIn ? "auth.createAccount" : "auth.signIn")}
        </Link>
      </p>

      {!isSignIn && entryContext === "direct" && !decision && (
        <p
          className="mt-4 text-sm text-muted-foreground"
          data-testid="direct-invitation-pointer"
        >
          {t("auth.invitationPointer")}
        </p>
      )}
      <Link
        className={cn(
          buttonVariants({ size: "sm", variant: "ghost" }),
          "mx-auto mt-5 flex w-fit",
        )}
        href="/"
      >
        {t("auth.home")}
      </Link>
    </div>
  );
}

function AuthEntryIntroduction({
  decision,
  entryContext,
  isSignIn,
  heading,
}: {
  decision: AuthFormProps["decision"];
  entryContext: AuthFormProps["entryContext"];
  isSignIn: boolean;
  heading: React.RefObject<HTMLHeadingElement | null>;
}) {
  const t = useTranslations("onboarding");
  return (
    <div className="mb-5">
      <h1
        ref={heading}
        tabIndex={-1}
        className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        {t(
          isSignIn
            ? "auth.signInHeading"
            : decision
              ? "auth.invitationHeading"
              : entryContext === "partner-setup"
                ? "auth.partnerHeading"
                : "auth.directHeading",
        )}
      </h1>
      {decision?.invitation && (
        <InvitationContext invitation={decision.invitation} step="verify" />
      )}
      <p className="mt-3 leading-7 text-muted-foreground">
        {t(
          decision
            ? isSignIn
              ? "auth.invitationSignInDescription"
              : "auth.invitationDescription"
            : isSignIn
              ? "auth.signInDescription"
              : entryContext === "partner-setup"
                ? "auth.partnerDescription"
                : "auth.directDescription",
        )}
      </p>
    </div>
  );
}

function AuthCredentialFields({
  isSignIn,
  error,
}: {
  isSignIn: boolean;
  error: React.ReactNode;
}) {
  const t = useTranslations("onboarding");
  return (
    <>
      {!isSignIn && (
        <Field>
          <FieldLabel htmlFor="name">{t("auth.name")}</FieldLabel>
          <Input
            autoComplete="name"
            id="name"
            data-testid="name"
            minLength={2}
            name="name"
            placeholder={t("auth.namePlaceholder")}
            required
          />
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor="email">{t("auth.email")}</FieldLabel>
        <Input
          autoComplete="email"
          id="email"
          data-testid="email"
          name="email"
          placeholder={t("auth.emailPlaceholder")}
          required
          type="email"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="password">{t("auth.password")}</FieldLabel>
        <Input
          autoComplete={isSignIn ? "current-password" : "new-password"}
          id="password"
          data-testid="password"
          minLength={8}
          name="password"
          required
          type="password"
        />
        {!isSignIn && (
          <FieldDescription>{t("auth.passwordHint")}</FieldDescription>
        )}
      </Field>

      {error && <FieldError data-testid="auth-form-error">{error}</FieldError>}
    </>
  );
}

function SubmitButton({ isSignIn }: { isSignIn: boolean }) {
  const { pending } = useFormStatus();

  const t = useTranslations("onboarding");
  const label = t(
    pending
      ? isSignIn
        ? "auth.signingIn"
        : "auth.creatingAccount"
      : isSignIn
        ? "auth.signIn"
        : "auth.createAccount",
  );

  return (
    <Button data-testid="auth-submit" disabled={pending} type="submit">
      {pending && (
        <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
      )}
      {label}
      {!pending && <ArrowRightIcon data-icon="inline-end" />}
    </Button>
  );
}
