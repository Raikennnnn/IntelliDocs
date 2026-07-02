import { useEffect, useState } from 'react';
import { isStaffDesktopViewport, staffDesktopMediaQuery } from '../lib/staffDesktopViewport';

export function useStaffDesktopViewport() {
  const [allowed, setAllowed] = useState(() =>
    typeof window !== 'undefined' ? isStaffDesktopViewport() : true,
  );

  useEffect(() => {
    const mql = window.matchMedia(staffDesktopMediaQuery);
    const update = () => setAllowed(isStaffDesktopViewport());
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return allowed;
}
