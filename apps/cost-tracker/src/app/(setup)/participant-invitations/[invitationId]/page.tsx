import type { Metadata } from "next";

import { ParticipantJoin } from "@/features/authentication/components/participant-onboarding";
import {
  AGREEMENT_COPY,
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
} from "@/features/authentication/participant-agreement";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Accept Project invitation" };

export default async function ParticipantInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ invitationId: string }>;
  searchParams: Promise<{ secret?: string | string[] }>;
}) {
  await requireSession();
  const [{ invitationId }, { secret }] = await Promise.all([
    params,
    searchParams,
  ]);
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <ParticipantJoin
        agreement={{
          ...CURRENT_PARTICIPANT_AGREEMENT_VERSION,
          content: AGREEMENT_COPY,
        }}
        source={
          invitationId && typeof secret === "string" && secret
            ? { kind: "invitation", invitationId, secret }
            : null
        }
      />
    </main>
  );
}
