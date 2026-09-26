import type { Metadata } from "next";

import { ParticipantJoin } from "@/features/authentication/components/participant-onboarding";
import { CURRENT_PARTICIPANT_AGREEMENT_VERSION } from "@/features/authentication/participant-agreement";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Accept Project invitation" };

export default async function ParticipantInvitationPage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  await requireSession();
  const { invitationId } = await params;
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <ParticipantJoin
        agreement={CURRENT_PARTICIPANT_AGREEMENT_VERSION}
        source={invitationId ? { kind: "invitation", invitationId } : null}
      />
    </main>
  );
}
