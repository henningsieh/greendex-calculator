import { CREATE_ORG_PATH, DASHBOARD_PATH } from "@/app/routes";
import {
  checkAuthAndOrgs,
  handleUnauthenticatedRedirect,
} from "@/features/authentication/utils";
import { redirect } from "@/lib/i18n/routing";
import type { LocaleParams } from "@/lib/i18n/types";

// See apps/calculator/docs/README.md#instant-navigation-opt-outs.
export const instant = false;

/**
 * Organization Setup Layout
 *
 * This layout ensures that only authenticated users WITHOUT organizations can access this route group.
 * - Unauthenticated users -> redirected to /login (with nextPageUrl preserved)
 * - Authenticated users WITH orgs -> redirected to /org/dashboard
 * - Authenticated users WITHOUT orgs -> can access (org-setup) pages
 *
 * Organization lookup failures are treated as having no organizations;
 * session lookup failures propagate. Redirects use the route locale.
 */
export default async function OrgSetupLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<LocaleParams>;
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
