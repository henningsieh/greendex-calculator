"use client";

import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { BreadcrumbRouteItem } from "@/features/breadcrumbs/breadcrumb-routes";
import { Link } from "@/lib/i18n/routing";
import { viewTransitionType } from "@/lib/view-transitions";

export default function BreadcrumbTrail({
  items,
  current,
}: {
  items: BreadcrumbRouteItem[];
  current: string;
}) {
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList>
        {items.map((item) => (
          <Fragment key={item.href}>
            <BreadcrumbItem className="max-w-full min-w-0">
              <BreadcrumbLink
                render={
                  <Link
                    href={item.href}
                    data-testid={item.testId}
                    transitionTypes={[viewTransitionType.back]}
                  />
                }
              >
                {item.label}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}
        <BreadcrumbItem>
          <BreadcrumbPage variant="muted">{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
