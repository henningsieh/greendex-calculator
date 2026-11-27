import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/* LandingCtaButton — the single brand exception (#367).
   Only the landing-page main CTA may deliberately break the theme
   (large, glow-breathe via .ember-cta). Built on the standard
   buttonVariants so theme colors apply; the breathe lives only here,
   never in ui/button.tsx. */
function LandingCtaButton({
  href = "/register",
  className,
  children,
}: {
  href?: React.ComponentProps<typeof Link>["href"];
  className?: string;
  children: ReactNode;
}) {
  /* Wrap-tolerant at large text: the translated label plus icon, gap, and
     lg padding exceed a 375px column, so the label breaks to centered
     lines instead of forcing its section wider. min-h keeps the
     single-line height unchanged. */
  return (
    <Link
      className={cn(
        buttonVariants({ size: "lg" }),
        "ember-cta group rounded-full",
        "h-auto min-h-11 text-center whitespace-normal",
        className,
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

export { LandingCtaButton };
