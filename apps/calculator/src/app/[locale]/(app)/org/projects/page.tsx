/**
 * @file Projects page
 *
 * Organization projects page with list of projects and create project button
 */

import { getTranslations } from "@greendex/i18n/server";
import { headers } from "next/headers";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { ContentContainer } from "@/components/content-container";
import { PageHeader } from "@/components/page-header";
import { NuqsProvider } from "@/components/providers/nuqs-adapter";
import { CreateProjectButton } from "@/features/projects/components/create-project-button";
import { ProjectsTab } from "@/features/projects/components/dashboard/projects-tab";
import { ProjectsTabSkeleton } from "@/features/projects/components/dashboard/projects-table";
import { PROJECT_ICONS } from "@/features/projects/components/project-icons";
import { DEFAULT_PROJECT_SORT } from "@/features/projects/types";
import { auth } from "@/lib/better-auth";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

/**
 * Render the Projects page with server-side data prefetching and permission-aware UI.
 *
 * Prefetches the projects list, active organization, and organization role data into the query cache
 * and checks whether the current request has permission to create projects; the UI shows a
 * conditional CreateProjectButton when creation is allowed. The main content renders the ProjectsTab
 * wrapped in Suspense with an error boundary.
 *
 * @returns A React element representing the projects page layout (header, description, conditional create button, and the ProjectsTab content).
 */
// instant = false: kept on purpose — session- and permission-gated data
// page (create-project permission resolves per request and keys the UI);
// streaming it is a deliberate follow-up (#246).
export const instant = false;

export default async function ProjectsPage() {
  const t = await getTranslations("organization.projects");

  // Prefetch all required data on the server to prevent multiple Suspense triggers
  // Using await ensures data is in cache BEFORE dehydration
  const queryClient = getQueryClient();

  // Prefetch in parallel for better performance
  // IMPORTANT: Query options must match EXACTLY what ProjectsTab uses
  await Promise.all([
    queryClient
      .query(
        orpcQuery.projects.list.queryOptions({
          input: {
            sort_by: DEFAULT_PROJECT_SORT.column,
          },
        }),
      )
      .catch(swallowPrefetchError),
    queryClient
      .query(orpcQuery.organizations.getActive.queryOptions())
      .catch(swallowPrefetchError),
    queryClient
      .query(orpcQuery.organizations.getRole.queryOptions())
      .catch(swallowPrefetchError),
  ]);

  const { success: canCreate } = await auth.api.hasPermission({
    headers: await headers(),
    body: {
      permissions: {
        project: ["create"],
      },
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<PROJECT_ICONS.projects />}
        title={t("title")}
        description={t("description")}
        action={
          canCreate ? (
            <CreateProjectButton showIcon={true} variant="secondary" />
          ) : undefined
        }
      />
      <ContentContainer width="lg">
        <Suspense fallback={<ProjectsTabSkeleton />}>
          <ErrorBoundary fallback={<div>{t("error-message")}</div>}>
            <NuqsProvider>
              <ProjectsTab />
            </NuqsProvider>
          </ErrorBoundary>
        </Suspense>
      </ContentContainer>
    </div>
  );
}
