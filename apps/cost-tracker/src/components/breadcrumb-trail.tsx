import { Fragment } from "react";

import type { AppHref } from "@/app/routes";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Link } from "@/lib/i18n/routing";

export type BreadcrumbTrailItem = {
  label: string;
  href?: AppHref;
  testId?: string;
};

/**
 * Server-rendered breadcrumb trail for the shell header. Labels are static
 * by design: no entity names or payload strings ever appear in crumbs.
 */
export function BreadcrumbTrailFallback() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-7xl min-w-0 py-3 pr-5 pl-0 sm:pr-8 lg:pr-10"
    >
      <div className="flex items-center gap-2">
        <span className="h-3 w-16 animate-pulse rounded-full bg-muted" />
        <span className="size-3.5 shrink-0 rounded-full bg-muted" />
        <span className="h-3 w-28 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

export default function BreadcrumbTrail({
  items,
  current,
}: {
  items: BreadcrumbTrailItem[];
  current: string;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 py-3 pr-5 pl-0 sm:pr-8 lg:pr-10">
      <div className="flex items-center lg:gap-1">
        <SidebarTrigger className="shrink-0 lg:m-0" />
        <Breadcrumb>
          <BreadcrumbList>
            {items.map((item, index) => (
              <Fragment key={item.label ?? index}>
                <BreadcrumbItem className="max-w-full min-w-0">
                  {item.href ? (
                    <BreadcrumbLink
                      render={<Link href={item.href} data-testid={item.testId} />}
                    >
                      {item.label}
                    </BreadcrumbLink>
                  ) : (
                    <span className="min-w-0 wrap-anywhere">{item.label}</span>
                  )}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </Fragment>
            ))}
            <BreadcrumbItem>
              <BreadcrumbPage variant="muted">{current}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}
