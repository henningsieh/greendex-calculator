"use client";

import { useTranslations } from "@greendex/i18n/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckInbox } from "@/features/authentication/components/check-inbox";
import { InvitationContext } from "@/features/authentication/components/invitation-context";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import type { OnboardingDecision } from "@/features/authentication/onboarding-decision";
import { SelectOrganization } from "@/features/organizations/components/select-organization";
import { orpc } from "@/lib/orpc/orpc";

export function InvitationAcceptance({
  returnTo,
  initialDecision,
  onAuthenticate,
  onDecision,
  onRejected,
}: {
  returnTo: string;
  initialDecision?: OnboardingDecision;
  onAuthenticate?: () => void;
  onDecision?: (decision: OnboardingDecision) => void;
  onRejected?: (organizationName: string) => void;
}) {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const [decision, setDecision] = useState(initialDecision);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [rejectedOrganization, setRejectedOrganization] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);

  const continueJourney = useCallback(
    (next: OnboardingDecision) => {
      setDecision(next);
      onDecision?.(next);
      if (next.nextStep === "continue")
        router.replace(next.availableActions[0].destination);
      if (next.nextStep === "authenticate") {
        onAuthenticate?.();
        const action = next.availableActions[0];
        router.replace(
          `/${"entry" in action ? action.entry : "login"}${action.returnTo ? `?next=${encodeURIComponent(action.returnTo)}` : ""}`,
        );
      }
    },
    [router, onAuthenticate, onDecision],
  );

  useEffect(() => {
    let active = true;
    if (initialDecision) continueJourney(initialDecision);
    else
      void orpc.authentication
        .onboardingNextStep({ returnTo })
        .then((next) => {
          if (active) continueJourney(next);
        })
        .catch(() => {
          if (active) setError(true);
        });
    return () => {
      active = false;
    };
  }, [returnTo, initialDecision, continueJourney]);

  useEffect(() => {
    heading.current?.focus();
  }, [decision?.nextStep]);

  const currentReturnTo =
    decision?.nextStep === "resolve-invitation" ? decision.returnTo : returnTo;

  async function recheck() {
    setPending(true);
    setError(false);
    try {
      continueJourney(
        await orpc.authentication.onboardingNextStep({
          returnTo: currentReturnTo,
        }),
      );
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  async function accept() {
    if (
      (decision?.nextStep !== "accept-invitation" &&
        decision?.nextStep !== "resolve-invitation") ||
      pending
    )
      return;
    setPending(true);
    setError(false);
    try {
      await orpc.organizations.acceptInvitation({
        invitationId: decision.availableActions[0].invitationId,
      });
    } catch {
      setError(true);
    }
    try {
      continueJourney(
        await orpc.authentication.onboardingNextStep({
          returnTo: currentReturnTo,
        }),
      );
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  async function reject() {
    if (
      (decision?.nextStep !== "accept-invitation" &&
        decision?.nextStep !== "resolve-invitation") ||
      pending
    )
      return;
    setPending(true);
    setError(false);
    try {
      await orpc.organizations.rejectInvitation({
        invitationId: decision.invitation.invitationId,
      });
      const next = await orpc.authentication.onboardingNextStep({
        returnTo:
          decision.nextStep === "resolve-invitation"
            ? decision.returnTo
            : undefined,
      });
      setRejectedOrganization(decision.invitation.organization.name);
      onRejected?.(decision.invitation.organization.name);
      setDecision(next);
      onDecision?.(next);
    } catch {
      setError(true);
      try {
        const next = await orpc.authentication.onboardingNextStep({
          returnTo: currentReturnTo,
        });
        setDecision(next);
        onDecision?.(next);
      } catch {
        // Keep the last authoritative state until a successful retry.
      }
    } finally {
      setPending(false);
    }
  }

  if (decision?.nextStep === "verify-email")
    return <CheckInbox email={decision.email} decision={decision} />;
  if (decision?.nextStep === "select-organization")
    return (
      <div>
        {rejectedOrganization && (
          <output data-testid="invitation-rejected">
            {t("invitation.rejected", { organization: rejectedOrganization })}
          </output>
        )}
        <SelectOrganization
          organizations={decision.availableActions[0].organizations}
          onSelected={recheck}
          signOutDestination={
            "destination" in decision.availableActions[1]
              ? decision.availableActions[1].destination
              : undefined
          }
        />
      </div>
    );

  return (
    <section
      aria-labelledby="invitation-heading"
      aria-busy={pending}
      data-onboarding-state={decision?.nextStep ?? "loading"}
    >
      <h1
        id="invitation-heading"
        ref={heading}
        tabIndex={-1}
        className="font-heading text-3xl font-semibold"
      >
        {t("invitation.heading")}
      </h1>
      {!decision && !error && <output>{t("invitation.checking")}</output>}
      {rejectedOrganization && (
        <output data-testid="invitation-rejected">
          {t("invitation.rejected", { organization: rejectedOrganization })}
        </output>
      )}
      {decision?.nextStep === "resolve-invitation" && (
        <p className="mt-4" data-testid="organization-creation-blocked">
          {t("invitation.creationBlocked", {
            organization: decision.invitation.organization.name,
          })}
        </p>
      )}
      {(decision?.nextStep === "accept-invitation" ||
        decision?.nextStep === "resolve-invitation") && (
        <>
          <div
            className="mt-4"
            data-testid="invitation-preview"
            data-organization-name={decision.invitation.organization.name}
          >
            <InvitationContext invitation={decision.invitation} step="accept" />
          </div>
          <p className="mb-4">{t("invitation.options")}</p>
          <Button
            data-testid="accept-organization-invitation"
            disabled={pending}
            onClick={accept}
            type="button"
          >
            {t(pending ? "invitation.joining" : "invitation.accept")}
          </Button>
          <Button
            className="mt-4"
            variant="outline"
            data-testid="reject-organization-invitation"
            disabled={pending}
            onClick={reject}
            type="button"
          >
            {t("invitation.reject", {
              organization: decision.invitation.organization.name,
            })}
          </Button>
        </>
      )}
      {(decision?.nextStep === "create-organization" ||
        decision?.nextStep === "continue") && (
        <Link
          href="/projects"
          onClick={() => router.refresh()}
          data-testid="invitation-next-step"
        >
          {t("invitation.continue")}
        </Link>
      )}
      {decision?.nextStep === "invitation-recovery" && (
        <InvitationRecovery reason={decision.reason} />
      )}
      {error && (
        <p className="mt-4" role="alert" data-testid="invitation-error">
          {t("error.request")}
        </p>
      )}
      {(decision?.availableActions.some((action) => action.kind === "recheck") ||
        error) && (
        <Button
          data-testid="recheck-organization-invitation"
          className="mt-4"
          disabled={pending}
          onClick={recheck}
          type="button"
        >
          {t("invitation.recheck")}
        </Button>
      )}
      {decision?.nextStep === "invitation-recovery" &&
        decision.availableActions.map((action) =>
          action.kind === "authenticate" ? (
            <Link
              className="mt-4 block underline underline-offset-4"
              data-testid="invitation-recovery-sign-in"
              key={action.kind}
              href={`/login?next=${encodeURIComponent(action.returnTo)}`}
            >
              {t("auth.signIn")}
            </Link>
          ) : null,
        )}
      {decision?.availableActions.map((action) =>
        action.kind === "sign-out" ? (
          <div className="mt-4" key={action.kind}>
            <SignOutButton
              destination={
                "destination" in action ? action.destination : undefined
              }
            />
          </div>
        ) : null,
      )}
      {decision?.nextStep === "invitation-recovery" && (
        <Link href="/projects" data-testid="invitation-current-access">
          {t("invitation.continue")}
        </Link>
      )}
    </section>
  );
}

export function InvitationRecovery({ reason }: { reason: string }) {
  const t = useTranslations("onboarding");
  const guidance =
    reason === "STAFF_INVITATION_WRONG_EMAIL"
      ? "wrongEmail"
      : reason === "STAFF_INVITATION_EXPIRED"
        ? "expired"
        : reason === "STAFF_INVITATION_REJECTED"
          ? "rejected"
          : reason === "STAFF_INVITATION_WITHDRAWN"
            ? "withdrawn"
            : reason === "STAFF_INVITATION_ACCEPTED"
              ? "accepted"
              : reason === "STAFF_INVITATION_CLOSED"
                ? "closed"
                : "unavailable";
  return (
    <Alert className="mt-4" variant="info" data-invitation-recovery={reason}>
      <AlertTitle>{t("recovery.title")}</AlertTitle>
      <AlertDescription>
        <p
          data-testid="invitation-recovery-guidance"
          data-recovery-guidance={guidance}
        >
          {t(`recovery.${guidance}`)}
        </p>
        <p>{t("recovery.recheck")}</p>
      </AlertDescription>
    </Alert>
  );
}
