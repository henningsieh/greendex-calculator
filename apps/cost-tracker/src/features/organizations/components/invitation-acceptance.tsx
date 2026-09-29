"use client";

import { ORPCError } from "@orpc/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc } from "@/lib/orpc/orpc";

// Allowlisted server messages mapped to actionable copy. Never render a
// remote error message directly; unknown failures use the generic helper.
const ACCEPTANCE_ERROR_COPY: Record<string, string> = {
  "Organization Invitation not found.":
    "This Organization Invitation is expired, cancelled, or addressed to another email address.",
  "Organization Invitation is no longer pending.":
    "This Organization Invitation is no longer valid. Ask for a new invitation.",
  "Organization Invitation has expired.":
    "This Organization Invitation has expired. Ask for a new invitation.",
  "Sign in with the invited email address.":
    "This invitation was sent to a different email address. Sign in with the invited address.",
  "This invitation is not an Organization staff invitation.":
    "This link is not a staff Organization Invitation. Participant invitations are accepted through the Project join flow.",
};

const authClient = createAuthClient({ plugins: [organizationClient()] });

export function InvitationAcceptance({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void authClient.organization
      .getInvitation({ query: { id: invitationId } })
      .then(
        ({ data, error }) => {
          if (!active) return;
          if (error || !data) {
            setError(
              "This Organization Invitation is expired, cancelled, or addressed to another email address.",
            );
          } else {
            setOrganizationName(data.organizationName);
          }
        },
        () => {
          if (active) setError("Could not load this Organization Invitation.");
        },
      );
    return () => {
      active = false;
    };
  }, [invitationId]);

  async function accept() {
    setPending(true);
    setError(undefined);
    try {
      await orpc.organizations.acceptInvitation({ invitationId });
      router.replace("/projects");
    } catch (error) {
      if (error instanceof ORPCError && ACCEPTANCE_ERROR_COPY[error.message])
        setError(ACCEPTANCE_ERROR_COPY[error.message]);
      else setError(getORPCRequestErrorMessage(error).text);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="invitation-heading">
      <h1 id="invitation-heading" className="font-heading text-3xl font-semibold">
        Organization Invitation
      </h1>
      {organizationName ? (
        <>
          <p className="mt-4">
            You have been invited to join {organizationName}.
          </p>
          <Button
            className="mt-6"
            disabled={pending}
            onClick={accept}
            type="button"
          >
            {pending ? "Accepting…" : "Accept Organization Invitation"}
          </Button>
        </>
      ) : !error ? (
        <output className="mt-4">Loading Organization Invitation…</output>
      ) : null}
      {error && (
        <p className="mt-4 text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
