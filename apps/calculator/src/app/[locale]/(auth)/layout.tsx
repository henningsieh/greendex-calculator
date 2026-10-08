import { headers } from "next/headers";

import { CREATE_ORG_PATH, DASHBOARD_PATH } from "@/app/routes";
import { auth } from "@/lib/better-auth";
import { redirect } from "@/lib/i18n/routing";

// instant = false: kept on purpose — this layout is an authentication gate.
// The signed-in check must resolve before first paint (a signed-in visitor
// must never see the login form flash before the redirect), so there is no
// useful static shell for the wrong audience. Page-level `ensureStatic` is
// intentionally absent here: no navigation stage can stay static while the
// gate reads request headers. Restructuring into a streaming AuthGate is a
// deliberate follow-up, not part of this adoption (#246).
export const instant = false;

/**
 * Server-side layout that either renders authentication pages or redirects signed-in users to the appropriate app route.
 *
 * If a signed-in user exists, redirects to the dashboard when they belong to at least one organization, otherwise redirects to the organization creation flow. If no signed-in user exists, renders the provided auth-related children (e.g., login, signup, verify-email).
 *
 * Session and organization lookup failures propagate.
 *
 * @param children - Auth page content to render when there is no active user session.
 * @param params - Route params carrying the `[locale]` segment for redirects.
 * @returns The `children` wrapped in a fragment when no user session is present.
 */
export default async function AuthLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}>) {
  const { locale } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If the user is signed in, send them to the proper place:
  if (session?.user) {
    const organizations = await auth.api.listOrganizations({
      headers: await headers(),
    });

    const hasOrgs = Array.isArray(organizations) && organizations.length > 0;

    if (hasOrgs) {
      // Signed in and has orgs -> app dashboard
      redirect({
        href: DASHBOARD_PATH,
        locale,
      });
    } else {
      // Signed in but no organization -> send to org setup flow
      redirect({
        href: CREATE_ORG_PATH,
        locale,
      });
    }
  }

  // Not signed in -> show auth pages (login/signup/verify-email)
  return <>{children}</>;
}
