import { cn } from "cn";
import { ArrowUpRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { AppHref } from "@/app/routes";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/i18n/routing";

/**
 * Navigation dressed as the Button `link` variant: typographic, always
 * underlined, and never shaped like a Button, so a link never competes with
 * the actions next to it. The trailing arrow is part of the affordance — it
 * marks the control as "goes elsewhere" without extra copy.
 *
 * `density` replaces the Button size axis on purpose: the `link` variant pins
 * `h-auto min-h-9`, which clamps every smaller size to the same 36px. Density
 * resets `min-h-0` after the variant, so the heights actually differ. Callers
 * pick `compact` for dense registries and `default` for card footers and
 * prose rows; labels stay with the caller so this module owns no copy.
 */
const densityVariants = {
  compact: "h-6 min-h-0 gap-1 px-1 text-xs",
  default: "h-8 min-h-0 gap-1.5 px-1.5 text-sm",
} as const;

export function ButtonLink({
  children,
  className,
  density = "default",
  describedBy,
  href,
  icon,
  testId,
}: {
  children: ReactNode;
  className?: string;
  density?: keyof typeof densityVariants;
  describedBy?: string;
  href: AppHref;
  /** Leading entity icon; the trailing arrow is supplied here. */
  icon?: ReactNode;
  testId?: string;
}) {
  return (
    <Link
      aria-describedby={describedBy}
      className={cn(
        buttonVariants({ variant: "link" }),
        "whitespace-nowrap",
        densityVariants[density],
        className,
      )}
      data-testid={testId}
      href={href}
    >
      {icon}
      {children}
      <ArrowUpRightIcon aria-hidden="true" className="size-3.5 shrink-0" />
    </Link>
  );
}
