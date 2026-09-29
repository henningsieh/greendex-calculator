import type { Metadata } from "next";

import { ParticipantDashboard } from "@/features/authentication/components/participant-onboarding";
import {
  AGREEMENT_COPY,
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
} from "@/features/authentication/participant-agreement";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "My Project Participations" };

export default async function ParticipantPage() {
  await requireSession();
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <ParticipantDashboard
        agreement={{
          ...CURRENT_PARTICIPANT_AGREEMENT_VERSION,
          content: AGREEMENT_COPY,
        }}
      />
    </main>
  );
}
