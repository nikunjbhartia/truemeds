// web/src/hooks/useMediaQuery.js
// JS-state-driven responsive hook. Required because Tailwind media queries
// are invisible to JSDOM/happy-dom — components must branch in JS to be testable.

import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (ev) => setMatches(ev.matches);
    mql.addEventListener?.('change', handler) ?? mql.addListener(handler);
    setMatches(mql.matches);
    return () => {
      mql.removeEventListener?.('change', handler) ?? mql.removeListener(handler);
    };
  }, [query]);

  return matches;
}

// Convenience presets matching tailwind.config.js breakpoints.
export const useIsMobile  = () => !useMediaQuery('(min-width: 768px)');
export const useIsTablet  = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
