import type { Route } from "next";
import Link from "next/link";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type ProtectedPageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  breadcrumbs?: readonly {
    label: React.ReactNode;
    href?: Route<string>;
    testId?: string;
  }[];
  rightButton?: React.ReactNode;
};

export default function ProtectedPageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs = [],
  rightButton,
}: ProtectedPageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-3xl min-w-0">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => (
              <Fragment key={item.href ?? index}>
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
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <p className="mt-4 type-ember-eyebrow">{eyebrow}</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 text-lg/8 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {rightButton ? <div className="shrink-0">{rightButton}</div> : null}
    </header>
  );
}
