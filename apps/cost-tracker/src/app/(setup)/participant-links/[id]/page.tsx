import type { Metadata } from "next";

import { ParticipantJoin } from "@/features/authentication/components/participant-onboarding";
import { CURRENT_PARTICIPANT_AGREEMENT_VERSION } from "@/features/authentication/participant-agreement";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Join Project" };

export default async function ParticipantLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ secret?: string | string[] }>;
}) {
  await requireSession();
  const [{ id }, { secret }] = await Promise.all([params, searchParams]);
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <ParticipantJoin
        agreement={CURRENT_PARTICIPANT_AGREEMENT_VERSION}
        source={
          id && typeof secret === "string" && secret
            ? { kind: "link", id, secret }
            : null
        }
      />
    </main>
  );
}
