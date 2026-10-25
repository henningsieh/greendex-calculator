"use client";

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckInbox } from "@/features/authentication/components/check-inbox";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import type { OnboardingDecision } from "@/features/authentication/onboarding-decision";
import { SelectOrganization } from "@/features/organizations/components/select-organization";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc } from "@/lib/orpc/orpc";

const authClient = createAuthClient({ plugins: [organizationClient()] });

export function InvitationAcceptance({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<OnboardingDecision>();
  const [organizationName, setOrganizationName] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const returnTo = `/accept-invitation/${invitationId}`;

  const continueJourney = useCallback(
    (next: OnboardingDecision) => {
      setDecision(next);
      if (next.nextStep === "continue")
        router.replace(next.availableActions[0].destination);
      if (next.nextStep === "authenticate")
        router.replace(
          `/login?next=${encodeURIComponent(next.availableActions[0].returnTo ?? returnTo)}`,
        );
    },
    [router, returnTo],
  );

  useEffect(() => {
    let active = true;
    void orpc.authentication
      .onboardingNextStep({ returnTo })
      .then(async (next) => {
        if (!active) return;
        continueJourney(next);
        if (next.nextStep === "accept-invitation") {
          // The preview supplies display data only. The server decision owns actions.
          const { data } = await authClient.organization.getInvitation({
            query: { id: invitationId },
          });
          if (active && data) setOrganizationName(data.organizationName);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(getORPCRequestErrorMessage(cause).text);
      });
    return () => {
      active = false;
    };
  }, [returnTo, invitationId, continueJourney]);

  async function recheck() {
    setPending(true);
    setError(undefined);
    try {
      continueJourney(await orpc.authentication.onboardingNextStep({ returnTo }));
    } catch (cause) {
      setError(getORPCRequestErrorMessage(cause).text);
    } finally {
      setPending(false);
    }
  }

  async function accept() {
    if (decision?.nextStep !== "accept-invitation") return;
    setPending(true);
    setError(undefined);
    try {
      await orpc.organizations.acceptInvitation({
        invitationId: decision.availableActions[0].invitationId,
      });
      continueJourney(await orpc.authentication.onboardingNextStep({ returnTo }));
    } catch (cause) {
      setError(getORPCRequestErrorMessage(cause).text);
      try {
        continueJourney(
          await orpc.authentication.onboardingNextStep({ returnTo }),
        );
      } catch {
        /* The mutation error remains visible if rechecking also fails. */
      }
    } finally {
      setPending(false);
    }
  }

  if (decision?.nextStep === "verify-email")
    return (
      <>
        <CheckInbox email={decision.email} />
        <SignOutButton />
      </>
    );
  if (decision?.nextStep === "select-organization")
    return (
      <SelectOrganization
        organizations={decision.availableActions[0].organizations}
        onSelected={recheck}
      />
    );

  return (
    <section aria-labelledby="invitation-heading" aria-busy={pending}>
      <h1 id="invitation-heading" className="font-heading text-3xl font-semibold">
        Join your Organization
      </h1>
      {!decision && !error && <output>Checking your invitation…</output>}
      {decision?.nextStep === "accept-invitation" && (
        <>
          <p
            className="mt-4"
            data-testid="invitation-preview"
            data-organization-name={organizationName}
          >
            {organizationName
              ? `You have been invited to join ${organizationName}.`
              : "Your invitation is ready. Join the Organization to continue."}
          </p>
          <Button
            className="mt-6"
            disabled={pending}
            onClick={accept}
            type="button"
          >
            {pending ? "Joining…" : "Accept Organization Invitation"}
          </Button>
        </>
      )}
      {decision?.nextStep === "invitation-recovery" && (
        <InvitationRecovery reason={decision.reason} />
      )}
      {error && (
        <p className="mt-4" role="alert">
          {error}
        </p>
      )}
      {(decision?.nextStep === "invitation-recovery" || error) && (
        <Button
          className="mt-4"
          disabled={pending}
          onClick={recheck}
          type="button"
        >
          Check invitation again
        </Button>
      )}
      {decision?.availableActions.some(
        (action) => action.kind === "sign-out",
      ) && (
        <div className="mt-4">
          <SignOutButton />
        </div>
      )}
    </section>
  );
}

export function InvitationRecovery({ reason }: { reason: string }) {
  return (
    <Alert className="mt-6" variant="info" data-invitation-recovery={reason}>
      <AlertTitle>Let&apos;s get you back to your invitation</AlertTitle>
      <AlertDescription>
        Open the complete link from your invitation email and sign in with the
        invited address. If it has expired or been cancelled, ask your
        Organization for a new invitation.
      </AlertDescription>
    </Alert>
  );
}
