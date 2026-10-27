"use client";

import { useTranslations } from "@greendex/i18n/client";

import type { OnboardingDecision } from "@/features/authentication/onboarding-decision";

type NamedInvitation = Extract<
  OnboardingDecision,
  { nextStep: "accept-invitation" }
>["invitation"];

export function InvitationContext({
  invitation,
  step,
}: {
  invitation: NamedInvitation;
  step: "verify" | "accept";
}) {
  const t = useTranslations("onboarding");
  return (
    <div
      className="mb-4"
      data-testid="invitation-context"
      data-organization-id={invitation.organization.id}
    >
      <p id="invitation-context-name" className="font-medium wrap-break-word">
        {t("invitation.context", { organization: invitation.organization.name })}
      </p>
      <ol
        className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm"
        data-testid="invitation-progress"
        aria-labelledby="invitation-context-name"
      >
        <li
          data-step="verify"
          data-state={step === "verify" ? "current" : "complete"}
          aria-current={step === "verify" ? "step" : undefined}
        >
          {t(step === "verify" ? "progress.verify" : "progress.verified")}
        </li>
        <li
          data-step="accept"
          data-state={step === "accept" ? "current" : "upcoming"}
          aria-current={step === "accept" ? "step" : undefined}
        >
          {t("progress.accept")}
        </li>
      </ol>
    </div>
  );
}
