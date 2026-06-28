/** Detect Vite/Rollup lazy-chunk failures after a new deploy (stale browser cache). */
const CHUNK_RELOAD_KEY = 'intellidocs_chunk_reload_v1';

export function isChunkLoadError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('failed to fetch dynamically imported module') ||
    m.includes('importing a module script failed') ||
    m.includes('error loading dynamically imported module') ||
    m.includes('loading chunk') ||
    (m.includes('load failed') && m.includes('.js'))
  );
}

function reloadOnceForStaleBundle(reason: string): boolean {
  try {
    const last = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    const now = Date.now();
    if (last && now - Number(last) < 60_000) {
      return false;
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    // ignore storage errors
  }
  console.warn('[IntelliDocs] Stale frontend bundle — reloading once after deploy.', reason);
  window.location.reload();
  return true;
}

/** Auto-reload once when a lazy route chunk 404s after deployment. */
export function installChunkLoadRecovery(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string } | string | undefined;
    const msg = String(
      typeof reason === 'object' && reason !== null && 'message' in reason
        ? reason.message
        : reason ?? '',
    );
    if (isChunkLoadError(msg)) {
      event.preventDefault();
      reloadOnceForStaleBundle(msg);
    }
  });

  window.addEventListener(
    'error',
    (event) => {
      const target = event.target as HTMLScriptElement | null;
      const src = target?.src ?? '';
      const msg = String(event.message ?? '');
      if (src.includes('/assets/') && event.type === 'error') {
        reloadOnceForStaleBundle(src || msg);
        return;
      }
      if (isChunkLoadError(msg)) {
        reloadOnceForStaleBundle(msg);
      }
    },
    true,
  );
}
