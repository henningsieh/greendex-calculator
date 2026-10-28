import type { Metadata } from "next";

import { SetupLinkRecipient } from "@/features/partnerships/components/setup-link";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Partner Organization setup" };

// Link secret stays in the sign-in return URL; the recipient gate resolves per request.
export const instant = false;

export default async function SetupLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ secret?: string | string[] }>;
}) {
  const [{ id }, { secret }] = await Promise.all([params, searchParams]);
  const linkSecret = typeof secret === "string" ? secret : undefined;
  // A signed-out recipient returns here after sign-in with the secret intact.
  const session = await requireSession(
    linkSecret
      ? `/setup-links/${id}?secret=${encodeURIComponent(linkSecret)}`
      : `/setup-links/${id}`,
  );
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <SetupLinkRecipient
        key={`${session.user.id}:${id}`}
        id={id}
        secret={linkSecret}
        userId={session.user.id}
      />
    </main>
  );
}
