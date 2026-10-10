import { RouteIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type SiteBrandProps = {
  className?: string;
  href?: string;
};

export function SiteBrand({ className, href = "/" }: SiteBrandProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center gap-3 font-heading text-lg font-semibold tracking-tight",
        className,
      )}
      href={href}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <RouteIcon aria-hidden="true" className="size-4" />
      </span>
      <span>Cost Tracker</span>
    </Link>
  );
}
