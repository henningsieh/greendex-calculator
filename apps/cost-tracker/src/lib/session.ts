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

/**
 * A Partner setup-link destination (`/setup-links/<id>?secret=...`) that is
 * safe to return to after sign-in. The secret is base64url, so the query
 * string carries no `&` separator and survives the `next` parameter intact.
 */
export function setupLinkReturnTo(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^\/setup-links\/[A-Za-z0-9_-]{1,128}(?:\?secret=[A-Za-z0-9_-]{1,256})?$/.test(
    value,
  )
    ? value
    : undefined;
}

/** Any setup destination a signed-out recipient may resume after sign-in. */
export function safeSignInReturnTo(
  value: string | string[] | undefined,
): string | undefined {
  return invitationReturnTo(value) ?? setupLinkReturnTo(value);
}

export async function requireSession(returnTo?: string) {
  const session = await getSession();

  if (!session)
    redirect(
      returnTo && safeSignInReturnTo(returnTo)
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
