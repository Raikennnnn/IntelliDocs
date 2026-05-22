import { useEffect, useRef } from 'react';
import { router } from '../routes';

/** Scroll window to top whenever the route changes (e.g. strand links from landing/admissions). */
export function ScrollToTop() {
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    return router.subscribe((state) => {
      const { pathname, search, hash } = state.location;
      const key = `${pathname}${search}${hash}`;
      if (lastKey.current === key) {
        return;
      }
      lastKey.current = key;

      if (hash) {
        const el = document.getElementById(hash.replace(/^#/, ''));
        if (el) {
          el.scrollIntoView({ block: 'start' });
          return;
        }
      }

      window.scrollTo({ top: 0, left: 0 });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, []);

  return null;
}
