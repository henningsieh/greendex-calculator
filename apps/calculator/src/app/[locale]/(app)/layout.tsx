import { cookies } from "next/headers";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { CREATE_ORG_PATH, DASHBOARD_PATH } from "@/app/routes";
import {
  AppBreadcrumb,
  AppBreadcrumbSkeleton,
} from "@/components/app-breadcrumb";
import { AppSidebar, AppSidebarSkeleton } from "@/components/app-sidebar";
import { LoadingProvider } from "@/components/providers/loading-provider";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import {
  checkAuthAndOrgs,
  handleUnauthenticatedRedirect,
} from "@/features/authentication/utils";
import { redirect } from "@/lib/i18n/routing";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

// instant = false: kept on purpose — this layout is an authentication and
// organization gate (redirects before paint) that also reads the sidebar
// cookie and prefetches session-keyed queries. The descendant data pages
// carry their own per-route decisions below; restructuring the gate into a
// streaming AuthGate is a deliberate follow-up, not part of this adoption
// (#246).
export const instant = false;

/**
 * App root layout that enforces authentication and organization presence, prefetches client data, and renders the main application shell.
 *
 * This layout:
 * - Redirects unauthenticated users to an appropriate unauthenticated route.
 * - Redirects users without organizations to the create-organization route.
 * - Reads the persisted sidebar state from cookies.
 * - Prefetches queries required by client components to avoid hydration mismatches.
 *
 * Organization lookup failures are treated as having no organizations. Query
 * prefetch failures are ignored; session lookup failures propagate.
 *
 * @param params - Route locale used for authentication and organization redirects.
 * @param children - Content rendered inside the main application area beneath the header and alongside the sidebar.
 * @returns The application layout element containing the sidebar, header (breadcrumb), main content area, and global UI providers (hydration, loading, error boundaries, toaster).
 */
export default async function AppLayout({
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
    const fallbackPath = DASHBOARD_PATH;
    const href = handleUnauthenticatedRedirect(rememberedPath, fallbackPath);
    redirect({
      href,
      locale,
    });
  }

  if (!hasOrgs) {
    redirect({
      href: CREATE_ORG_PATH,
      locale,
    });
  }

  const sidebarStateIsOpen =
    (await cookies()).get("sidebar_state")?.value === "true";

  // Prefetch all data needed by client components that use useSuspenseQuery.
  // Using await ensures data is in cache BEFORE dehydration, preventing hydration mismatches.
  // Components that need this data: AppBreadcrumb, AppSidebar (ProjectSwitcher, OrganizationSwitcher), Navbar (UserSession)
  const queryClient = getQueryClient();

  const prefetches = [
    queryClient
      .query(orpcQuery.betterauth.getSession.queryOptions())
      .catch(swallowPrefetchError),
    queryClient
      .query(orpcQuery.projects.list.queryOptions())
      .catch(swallowPrefetchError),
    queryClient
      .query(orpcQuery.organizations.list.queryOptions())
      .catch(swallowPrefetchError),
    queryClient
      .query(orpcQuery.organizations.getActive.queryOptions())
      .catch(swallowPrefetchError),
  ];

  await Promise.all(prefetches);

  // Authenticated and has orgs -> allow rendering of the protected app
  return (
    <HydrateClient client={queryClient}>
      <LoadingProvider>
        <SidebarProvider
          className="flex h-screen"
          defaultOpen={sidebarStateIsOpen}
        >
          <ErrorBoundary fallback={<div>Failed to load sidebar.</div>}>
            <Suspense fallback={<AppSidebarSkeleton />}>
              <AppSidebar />
            </Suspense>
          </ErrorBoundary>
          <SidebarInset className="flex flex-col overflow-hidden">
            <div className="flex h-15 shrink-0 items-center border-b pl-3.5 lg:pl-6">
              <div className="flex items-center md:hidden">
                <SidebarTrigger
                  /* eslint-disable-next-line shadcn/no-restyle -- Mobile navigation trigger intentionally uses muted color. */
                  className="text-muted-foreground"
                />
                <Separator
                  orientation="vertical"
                  className="m-2 data-[orientation=vertical]:h-4"
                />
              </div>

              <ErrorBoundary
                fallback={<div>Unable to load project breadcrumb</div>}
              >
                <Suspense fallback={<AppBreadcrumbSkeleton />}>
                  <AppBreadcrumb />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-auto p-0 sm:p-4">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </LoadingProvider>

      <Toaster position="top-right" richColors />
    </HydrateClient>
  );
}
