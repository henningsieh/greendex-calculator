import { useTranslations } from "@greendex/i18n/client";
import type { Route } from "next";
import Link from "next/link";

import { StarWreath } from "@/components/brand/star-wreath";
import { cn } from "@/lib/utils";

type SiteBrandProps = {
  className?: string;
  href?: Route;
};

/* Header lockup (LOCKED 2026-10-11; spelling corrected in #313): StarWreath (34px) + GreenDex
   (Sans 800, 19px) + Cost Tracker (Mono, 12px, tracking .18em). */
export function SiteBrand({ className, href = "/" }: SiteBrandProps) {
  const t = useTranslations("shell.brand");

  return (
    <Link
      data-testid="site-brand"
      className={cn("inline-flex items-center gap-3", className)}
      href={href}
    >
      <StarWreath data-testid="site-brand-mark" size={34} />
      <span className="flex flex-col leading-none">
        <span
          data-testid="site-brand-name"
          className="text-[19px] font-extrabold tracking-tight"
        >
          {t("name")}
        </span>
        <span className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
          {t("product")}
        </span>
      </span>
    </Link>
  );
}
