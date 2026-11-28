/**
 * Shared vocabulary for React view transitions.
 *
 * Transition types travel with a navigation (`<Link transitionTypes>` or
 * `router.push(href, { transitionTypes })`); the class names below are the
 * only place the CSS contract is named. `globals.css` targets the matching
 * `::view-transition-*` pseudo-elements, so adding a direction means adding
 * a type here, a class here, and one block there — never a per-page string.
 */
export const viewTransitionType = {
  /** Deeper into the hierarchy: list → detail. */
  forward: "nav-forward",
  /** Back up the hierarchy: detail → list. */
  back: "nav-back",
} as const;

export const viewTransitionClass = {
  navForward: "vt-nav-forward",
  navBack: "vt-nav-back",
} as const;

/**
 * Names for chrome that persists across protected navigations. Naming an
 * element pulls it out of the root snapshot; the matching `animation: none`
 * rules in `globals.css` keep it pinned while page content moves.
 */
export const persistentViewTransitionName = {
  appHeader: "app-header",
  appSidebar: "app-sidebar",
  toastViewport: "app-toast",
} as const;
