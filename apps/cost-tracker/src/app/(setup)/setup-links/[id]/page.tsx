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
  await requireSession();
  const [{ id }, { secret }] = await Promise.all([params, searchParams]);
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <SetupLinkRecipient
        id={id}
        secret={typeof secret === "string" ? secret : undefined}
      />
    </main>
  );
}
