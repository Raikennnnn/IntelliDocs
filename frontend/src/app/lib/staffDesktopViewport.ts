export const STAFF_PORTAL_MIN_WIDTH_PX = 1024;

export function isStaffDesktopViewport(width = typeof window !== 'undefined' ? window.innerWidth : STAFF_PORTAL_MIN_WIDTH_PX): boolean {
  return width >= STAFF_PORTAL_MIN_WIDTH_PX;
}

export const staffDesktopMediaQuery = `(min-width: ${STAFF_PORTAL_MIN_WIDTH_PX}px)`;
