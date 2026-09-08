import { ArrowRightIcon } from "lucide-react";

import { AppRoute } from "@/app/routes";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

type PillCTABaseProps = {
  children: React.ReactNode;
  className?: string;
  showNewBadge?: boolean;
};

type PillCTAButtonProps = PillCTABaseProps & {
  onClick: () => void;
  href?: never;
};

type PillCTALinkProps = PillCTABaseProps & {
  href: AppRoute;
  onClick?: never;
};

type PillCTAProps = PillCTAButtonProps | PillCTALinkProps;

/**
 * Premium pill-shaped CTA component
 * OpenClaw.ai style with enhanced visual treatment
 * Simple arrow icon, elegant hover state
 * Theme-aware (works in light/dark)
 *
 * Can be used as either a button (with onClick) or a link (with href)
 * One of onClick or href must be provided
 */
export function PillCTA({
  children,
  className,
  showNewBadge = false,
  ...props
}: PillCTAProps) {
  const baseClasses = cn(
    // Base styles
    "group relative inline-flex items-center gap-2.5 rounded-full",
    "border border-primary/60 bg-background/90",
    "px-4 py-3 text-sm font-medium text-foreground",
    // Subtle, elegant default shadow with soft backdrop blur
    "shadow-[0_8px_24px_rgba(4,120,87,0.15),0_4px_12px_rgba(0,0,0,0.25)] backdrop-blur-sm",
    // Smooth transitions
    "transition-all duration-250 ease-out",
    // Hover state - refined glow with sophisticated lift
    "hover:border-primary/80 hover:bg-background",
    "hover:shadow-[0_16px_48px_rgba(16,185,129,0.22),0_8px_24px_rgba(0,0,0,0.30)]",
    "hover:-translate-y-0.5 hover:scale-[1.02]",
    // Focus state
    "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
    // Active state - satisfying click feel
    "active:translate-y-0 active:scale-[0.98] active:duration-75",
    className,
  );

  const content = (
    <>
      {/* Subtle gradient overlay on hover (stronger) */}
      <span className="absolute inset-0 rounded-full bg-linear-to-r from-emerald-500/0 via-teal-500/0 to-cyan-500/0 opacity-0 transition-opacity duration-300 group-hover:from-emerald-500/15 group-hover:via-teal-500/15 group-hover:to-cyan-500/15 group-hover:opacity-100" />

      {showNewBadge && (
        <Badge className="relative rounded-full bg-linear-to-r from-emerald-600 to-teal-700 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
          NEW
        </Badge>
      )}
      <span className="relative">{children}</span>
      <ArrowRightIcon
        className="relative size-4 transition-transform duration-300 group-hover:translate-x-2"
        strokeWidth={2.5}
      />
    </>
  );

  // Render as link if href is provided
  if ("href" in props && props.href) {
    return (
      <Link className={baseClasses} href={props.href}>
        {content}
      </Link>
    );
  }

  // Render as button if onClick is provided
  if ("onClick" in props && props.onClick) {
    return (
      <button className={baseClasses} onClick={props.onClick} type="button">
        {content}
      </button>
    );
  }

  // This should never happen due to TypeScript types, but adding fallback for safety
  return null;
}
