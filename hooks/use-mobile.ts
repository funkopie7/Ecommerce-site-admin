import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Tracks whether the viewport is below Tailwind's `md` breakpoint. Used by the
 * sidebar to swap its desktop rail for an off-canvas sheet. Starts `undefined`
 * so the first render matches the server output, then resolves on mount.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    query.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
