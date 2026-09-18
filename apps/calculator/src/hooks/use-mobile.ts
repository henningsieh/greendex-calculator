import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Determines whether the current viewport width is less than MOBILE_BREAKPOINT.
 *
 * The hook attaches a media query listener and updates on viewport changes; it initially returns `undefined` until the effect runs on the client.
 *
 * @returns `true` if the viewport width is less than MOBILE_BREAKPOINT, `false` if greater than or equal, or `undefined` during server-side rendering or before the effect runs.
 */
export function useIsMobile(): boolean | undefined {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(mql.matches);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
