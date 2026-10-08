import type React from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Full-width page header component with icon, title, description, and optional action button.
 * Content is automatically constrained to max-w-7xl for consistent layout across all pages.
 *
 * @example
 * ```tsx
 * <PageHeader
 *   icon={<SettingsIcon  />}
 *   title="Settings"
 *   description="Manage your organization settings"
 *   action={<Button>Save</Button>}
 * />
 * ```
 */
export function PageHeader({
  icon,
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("w-full border-b bg-background pt-2 pb-6", className)}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-3 sm:min-w-0 sm:flex-1">
            <div className="flex min-w-0 items-center justify-start gap-3 font-serif">
              <span className="flex shrink-0 items-center justify-center text-2xl sm:text-3xl md:text-4xl [&_svg]:inline-block [&_svg]:size-[1em]">
                {icon}
              </span>
              <h1 className="truncate text-2xl font-bold whitespace-nowrap sm:text-3xl md:text-4xl">
                {title}
              </h1>
            </div>
            {description && (
              <div className="text-sm text-muted-foreground md:text-base">
                {description}
              </div>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
    </div>
  );
}
