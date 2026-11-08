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
  return (
    <Link
      className={cn(
        buttonVariants({ size: "lg" }),
        "ember-cta group rounded-full",
        className,
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

export { LandingCtaButton };
