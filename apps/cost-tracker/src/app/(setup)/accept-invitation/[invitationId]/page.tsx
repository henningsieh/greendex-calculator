import type { Metadata } from "next";

import { InvitationAcceptance } from "@/features/organizations/components/invitation-acceptance";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Organization Invitation" };

export default async function OrganizationInvitationPage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  await requireSession(`/accept-invitation/${invitationId}`);
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <InvitationAcceptance invitationId={invitationId} />
    </main>
  );
}
