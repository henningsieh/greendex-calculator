"use client";

import { useTranslations } from "@greendex/i18n/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InvitationContext } from "@/features/authentication/components/invitation-context";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import type { OnboardingDecision } from "@/features/authentication/onboarding-decision";
import { authClient } from "@/lib/auth-client";

type VerificationDecision = Extract<
  OnboardingDecision,
  { nextStep: "verify-email" }
>;

const RESEND_COOLDOWN_MS = 30_000;

type ResendAction = Extract<
  VerificationDecision["availableActions"][number],
  { kind: "resend-verification" }
>;

function ResendVerification({ action }: { action: ResendAction }) {
  const t = useTranslations("onboarding.inbox.resend");
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(false), RESEND_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    if (inFlight.current || cooldown) return;
    inFlight.current = true;
    setPending(true);
    setResult(null);
    try {
      const response = await authClient.sendVerificationEmail({
        email: action.email,
        callbackURL: action.callbackURL,
      });
      setResult(response.error ? "error" : "success");
    } catch {
      setResult("error");
    } finally {
      setCooldown(true);
      setPending(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="mt-4">
      <Button
        type="button"
        data-testid="inbox-resend-verification"
        disabled={pending || cooldown}
        aria-busy={pending}
        onClick={() => void resend()}
      >
        {t(pending ? "pending" : "label")}
      </Button>
      <output data-testid="inbox-resend-result" data-result={result}>
        {result ? t(result) : null}
      </output>
    </div>
  );
}

export function CheckInbox({
  email,
  decision,
}: {
  email: string;
  decision?: VerificationDecision;
}) {
  const t = useTranslations("onboarding");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const invitation =
    decision?.entryContext === "organization-invitation"
      ? decision.invitation
      : undefined;

  return (
    <section
      className="w-full max-w-md"
      aria-labelledby="check-inbox-heading"
      data-onboarding-state="verify-email"
    >
      <h1
        className="mb-4 font-heading text-3xl font-semibold tracking-tight"
        id="check-inbox-heading"
        ref={heading}
        tabIndex={-1}
      >
        {t("inbox.heading")}
      </h1>
      <Alert
        variant="info"
        emphasis="prominent"
        data-testid="auth-verification-message"
      >
        <AlertDescription>
          <p data-testid="verification-next-action">
            {t(invitation ? "inbox.invitationInstruction" : "inbox.instruction")}
          </p>
          {invitation && (
            <InvitationContext invitation={invitation} step="verify" />
          )}
          <p>
            {t.rich("inbox.address", {
              email,
              address: (chunks) => (
                <strong className="break-all" data-testid="verification-address">
                  {chunks}
                </strong>
              ),
            })}
          </p>
          <p>{t("inbox.spam")}</p>
        </AlertDescription>
      </Alert>
      {decision?.availableActions.map((action) =>
        action.kind === "authenticate" ? (
          <Link
            className="mt-4 block underline underline-offset-4"
            key={action.kind}
            data-testid="inbox-sign-in"
            href={`/login?next=${encodeURIComponent(action.returnTo ?? "")}`}
          >
            {t("inbox.signIn")}
          </Link>
        ) : action.kind === "resend-verification" ? (
          <ResendVerification key={action.kind} action={action} />
        ) : action.kind === "sign-out" ? (
          <div className="mt-4" key={action.kind}>
            <SignOutButton
              destination={
                "destination" in action ? action.destination : undefined
              }
            />
          </div>
        ) : null,
      )}
    </section>
  );
}
