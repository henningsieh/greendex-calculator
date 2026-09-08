import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export async function requireSession() {
  const session = await getSession();

  if (!session) redirect("/login");

  return session;
}

export const hasOrganizationMembership = cache(async () => {
  const organizations = await auth.api.listOrganizations({
    headers: await headers(),
  });

  return organizations.length > 0;
});
