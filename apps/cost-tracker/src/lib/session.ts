import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export function invitationReturnTo(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^\/accept-invitation\/[a-zA-Z0-9_-]{1,128}$/.test(value)
    ? value
    : undefined;
}

export async function requireSession(returnTo?: string) {
  const session = await getSession();

  if (!session)
    redirect(
      returnTo && invitationReturnTo(returnTo)
        ? `/login?next=${encodeURIComponent(returnTo)}`
        : "/login",
    );

  return session;
}

export const hasOrganizationMembership = cache(async () => {
  const organizations = await auth.api.listOrganizations({
    headers: await headers(),
  });

  return organizations.length > 0;
});
