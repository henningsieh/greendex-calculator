"use client";

import { useTranslations } from "@greendex/i18n/client";
import type { ComponentProps } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import {
  navigationForPage,
  protectedPages,
  type ProjectNavigationContext,
  type ProtectedPage,
} from "@/features/breadcrumbs/breadcrumb-routes";
import BreadcrumbTrail from "@/features/breadcrumbs/components/breadcrumb-trail";

export function ProtectedRouteHeader({
  page,
  context,
  ...header
}: Omit<ComponentProps<typeof ProtectedPageHeader>, "eyebrow" | "title"> & {
  context?: ProjectNavigationContext;
} & (
    | { page: "project" | "partnership"; title: string }
    | { page: Exclude<ProtectedPage, "project" | "partnership">; title?: string }
  )) {
  const t = useTranslations("shell");
  const { eyebrow, breadcrumb } = navigationForPage(page, t, context);
  const title = header.title ?? breadcrumb?.current;
  if (title === undefined) return null;
  return (
    <div
      className="min-w-0 space-y-4"
      data-navigation-section={protectedPages[page].section}
    >
      {breadcrumb ? <BreadcrumbTrail {...breadcrumb} /> : null}
      <ProtectedPageHeader {...header} eyebrow={eyebrow} title={title} />
    </div>
  );
}
