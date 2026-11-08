import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onStoreChange: () => void) {
  const mediaQueryList = window.matchMedia(MOBILE_QUERY);
  mediaQueryList.addEventListener("change", onStoreChange);
  return () => mediaQueryList.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/** The server has no viewport, so it renders the desktop layout. */
function getServerSnapshot() {
  return false;
}

export function useIsMobile() {
  // A media query is an external store: subscribing through it keeps the
  // viewport derived during render instead of syncing it from an effect.
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
