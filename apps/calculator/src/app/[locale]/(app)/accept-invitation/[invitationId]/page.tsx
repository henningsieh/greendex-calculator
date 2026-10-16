import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { HandleInvitation } from "@/features/authentication/components/handle-invitation";
import { auth } from "@/lib/better-auth";

/**
 * Render the invitation acceptance UI for a given invitation ID.
 *
 * @param params - A promise that resolves to an object containing `invitationId`, used to fetch the invitation.
 * @returns The `HandleInvitation` element for the fetched invitation. If the invitation does not exist, triggers a 404 page and returns `null`.
 */
// See apps/calculator/docs/README.md#instant-navigation-opt-outs.
export const instant = false;

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{
    invitationId: string;
  }>;
}) {
  const { invitationId } = await params;
  const requestHeaders = await headers();

  // User is authenticated, now we can safely fetch the invitation
  const invitation = await auth.api.getInvitation({
    query: {
      id: invitationId,
    },
    headers: requestHeaders,
  });

  if (!invitation?.id) {
    notFound();
    return null;
  }

  return <HandleInvitation invitation={invitation} />;
}
