import type { Metadata } from "next";

import { SetupLinkRecipient } from "@/features/projects/components/setup-link";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Partner Organization setup" };

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
  await requireSession(
    linkSecret
      ? `/setup-links/${id}?secret=${encodeURIComponent(linkSecret)}`
      : `/setup-links/${id}`,
  );
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <SetupLinkRecipient id={id} secret={linkSecret} />
    </main>
  );
}
