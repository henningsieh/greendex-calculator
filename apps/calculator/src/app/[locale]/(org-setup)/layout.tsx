import { CREATE_ORG_PATH, DASHBOARD_PATH } from "@/app/routes";
import {
  checkAuthAndOrgs,
  handleUnauthenticatedRedirect,
} from "@/features/authentication/utils";
import { redirect } from "@/lib/i18n/routing";

// instant = false: kept on purpose — this layout is an authentication gate.
// The membership check must resolve before first paint (visitors who do not
// belong here must never see the setup form flash before the redirect), so
// there is no useful static shell for the wrong audience (#246).
export const instant = false;

/**
 * Organization Setup Layout
 *
 * This layout ensures that only authenticated users WITHOUT organizations can access this route group.
 * - Unauthenticated users -> redirected to /login (with nextPageUrl preserved)
 * - Authenticated users WITH orgs -> redirected to /org/dashboard
 * - Authenticated users WITHOUT orgs -> can access (org-setup) pages
 */
export default async function OrgSetupLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}>) {
  const { locale } = await params;
  const { session, hasOrgs, rememberedPath } = await checkAuthAndOrgs();

  if (!session?.user) {
    const fallbackPath = CREATE_ORG_PATH;
    const href = handleUnauthenticatedRedirect(rememberedPath, fallbackPath);
    redirect({
      href,
      locale,
    });
  }

  if (hasOrgs) {
    redirect({
      href: DASHBOARD_PATH,
      locale,
    });
  }

  return <>{children}</>;
}
