"use client";

import { useTranslations } from "@greendex/i18n/client";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { InvitationContext } from "@/features/authentication/components/invitation-context";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import type { OnboardingDecision } from "@/features/authentication/onboarding-decision";

type VerificationDecision = Extract<
  OnboardingDecision,
  { nextStep: "verify-email" }
>;

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
