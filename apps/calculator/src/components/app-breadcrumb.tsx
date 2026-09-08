"use client";

import { useTranslations } from "@greendex/i18n/client";

import { SIDEBAR_GROUPS } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { PROJECT_ICONS } from "@/features/projects/components/project-icons";
import { Link, usePathname } from "@/lib/i18n/routing";

import { ORGANIZATION_ICONS } from "../features/organizations/organization-icons";

/**
 * AppBreadcrumb
 * - shows the current sidebar group label as the first crumb
 * - the current feature page as the second crumb
 * - if on a project detail page, shows the project name as a non-link last crumb
 */
export function AppBreadcrumb() {
  const pathname = usePathname();
  const t = useTranslations("app.sidebar");

  // Find the sidebar group that matches the current pathname
  const currentGroup =
    SIDEBAR_GROUPS.find((g) =>
      g.items.some((i) => pathname === i.url || pathname.startsWith(`${i.url}/`)),
    ) ?? SIDEBAR_GROUPS[0];

  // Determine the feature item (e.g., Dashboard, Projects, Participants)
  const featureItem =
    currentGroup.items.find(
      (i) => pathname === i.url || pathname.startsWith(`${i.url}/`),
    ) ?? currentGroup.items[0];

  const segments = pathname.split("/").filter(Boolean);
  const isProjectDetail =
    segments[0] === "org" && segments[1] === "projects" && !!segments[2];

  const CrumbIcon: React.ReactElement = (() => {
    switch (currentGroup.labelKey) {
      case "organization.groupLabel":
        return (
          <ORGANIZATION_ICONS.organization className="mr-2 inline size-4 text-primary" />
        );
      case "projects.groupLabel":
        return (
          <PROJECT_ICONS.projects className="mr-2 inline size-5 text-secondary" />
        );
      case "projects.archiveLabel":
        return (
          <PROJECT_ICONS.archive className="mr-2 inline size-4 text-muted-foreground" />
        );
      default:
        return currentGroup.labelKey satisfies never;
    }
  })();

  return (
    <Breadcrumb tabIndex={-1}>
      <BreadcrumbList>
        {/* First crumb: Sidebar group label (link to group's primary route) */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={currentGroup.items[0].url}>
              {CrumbIcon}
              {t(currentGroup.labelKey)}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        {/* Second crumb: feature page. If we are on a project detail, this stays a link; otherwise it's the final page and not a link */}
        <BreadcrumbItem>
          {isProjectDetail ? (
            <BreadcrumbLink asChild>
              <Link href={featureItem.url}>{t(featureItem.titleKey)}</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{t(featureItem.titleKey)}</BreadcrumbPage>
          )}
        </BreadcrumbItem>

        {/* Optional last crumb: non-link project name */}
        {isProjectDetail && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("projects.details")}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function AppBreadcrumbSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="size-7 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-md" />
      </div>
      <Skeleton className="size-4 rounded-md" />
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded-md" />
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>
    </div>
  );
}
