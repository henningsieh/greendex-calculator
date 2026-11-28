"use client";

import { useTranslations } from "@greendex/i18n/client";

import { breadcrumbForPath } from "@/features/breadcrumbs/breadcrumb-routes";
import BreadcrumbTrail from "@/features/breadcrumbs/components/breadcrumb-trail";
import { usePathname } from "@/lib/i18n/routing";

/**
 * The shell's breadcrumb trail. It derives every crumb from the pathname in
 * the same commit as the route, so React reconciles the list and only the
 * changed crumb is rendered — no request-time query, no Suspense fallback,
 * and no full breadcrumb reload on navigation.
 */
export function BreadcrumbNav() {
  // The shell is also rendered in isolation (tests, error recovery) without a
  // router context; a neutral Projects crumb beats throwing the whole shell.
  const pathname = usePathname() ?? "/projects";
  const t = useTranslations("shell");
  const { items, current } = breadcrumbForPath(pathname, t);

  return <BreadcrumbTrail items={items} current={current} />;
}
