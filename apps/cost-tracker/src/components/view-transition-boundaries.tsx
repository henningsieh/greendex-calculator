import { ViewTransition } from "react";

import { viewTransitionClass } from "@/lib/view-transitions";

/**
 * The only route boundary in the app: one per page, never in a layout or
 * template.
 *
 * Enter-only on purpose. Section Suspense arrivals are silent. An exit
 * animation would move an outgoing page that is already gone and leave a
 * one-sided ghost. Only typed navigation slides the new page in.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      default="none"
      enter={{
        "nav-forward": viewTransitionClass.navForward,
        "nav-back": viewTransitionClass.navBack,
        default: "none",
      }}
    >
      {children}
    </ViewTransition>
  );
}
