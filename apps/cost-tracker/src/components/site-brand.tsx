import Link from "next/link";

import { StarWreath } from "@/components/brand/star-wreath";
import { cn } from "@/lib/utils";

type SiteBrandProps = {
  className?: string;
  href?: string;
};

/* Header lockup (LOCKED 2026-10-11): StarWreath (34px) + GreenEx
   (Sans 800, 19px) + Cost Tracker (Mono, 12px, tracking .18em). */
export function SiteBrand({ className, href = "/" }: SiteBrandProps) {
  return (
    <Link className={cn("inline-flex items-center gap-3", className)} href={href}>
      <StarWreath size={34} />
      <span className="flex flex-col leading-none">
        <span className="text-[19px] font-extrabold tracking-tight">GreenEx</span>
        <span className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
          Cost Tracker
        </span>
      </span>
    </Link>
  );
}
