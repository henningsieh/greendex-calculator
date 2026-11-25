import { ViewTransition } from "react";

import { viewTransitionClass } from "@/lib/view-transitions";

/**
 * The four view-transition boundaries the app uses. Every page owns one
 * `RouteTransition`; no layout or template does, because those persist and
 * would swallow the page's enter/exit. `LoadingTransition` is the route
 * `loading.tsx` counterpart. The two Suspense boundaries stay untyped:
 * Suspense resolutions run in their own transition, without the navigation's
 * types, so they can only use the simple class props.
 */

/**
 * Route-change boundary for a page component. One per page, never in a
 * layout or template: the page unmounts on navigation, which is what fires
 * enter/exit. Directional types win; an untyped arrival (the page replacing
 * `loading.tsx` in a later Suspense transition) falls back to a fade.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      default="none"
      enter={{
        "nav-forward": viewTransitionClass.navForward,
        "nav-back": viewTransitionClass.navBack,
        default: viewTransitionClass.fadeIn,
      }}
      exit={{
        "nav-forward": viewTransitionClass.navForward,
        "nav-back": viewTransitionClass.navBack,
        default: viewTransitionClass.fadeOut,
      }}
    >
      {children}
    </ViewTransition>
  );
}

/** Slides resolved content up into the space its skeleton reserved. */
export function SuspenseReveal({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition default="none" enter={viewTransitionClass.slideUp}>
      {children}
    </ViewTransition>
  );
}

/**
 * Route-level `loading.tsx` wrapper. It mounts in the navigation transition
 * (so `enter` sees the transition types and slides in from the matching
 * side), then leaves in the later Suspense transition with a plain
 * slide-down. One boundary, so the exit is not suppressed by a nested one.
 */
export function LoadingTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      default="none"
      enter={{
        "nav-forward": viewTransitionClass.navForward,
        "nav-back": viewTransitionClass.navBack,
        default: viewTransitionClass.fadeIn,
      }}
      exit={viewTransitionClass.slideDown}
    >
      {children}
    </ViewTransition>
  );
}

/** Slides a replaced skeleton down and out. Pair with `SuspenseReveal`. */
export function SuspenseFallback({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition default="none" exit={viewTransitionClass.slideDown}>
      {children}
    </ViewTransition>
  );
}
