import { ViewTransition } from "react";

import { viewTransitionClass } from "@/lib/view-transitions";

/**
 * The only route boundary in the app: one per page, never in a layout or
 * template.
 *
 * Enter-only on purpose. This app streams every protected page behind
 * `loading.tsx` + inner Suspense boundaries; an exit animation would move an
 * outgoing page that is already gone and leave a one-sided ghost. Untyped page
 * arrivals (the page replacing `loading.tsx` in its own Suspense transition)
 * resolve to `"none"` and stay silent. Only a typed navigation that commits
 * the destination content in the same transition slides the new page in.
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
