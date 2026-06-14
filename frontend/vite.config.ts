import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function figmaAssetPlugin(): Plugin {
  return {
    name: 'figma-asset',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        return '\0figma-asset:' + id;
      }
    },
    load(id) {
      if (id.startsWith('\0figma-asset:')) {
        return 'export default ""';
      }
    },
  };
}

/** Base path of the CodeIgniter `public/` folder when proxying through XAMPP/Apache.
 *
 * Override per-machine in `frontend/.env` or `frontend/.env.local`:
 *   VITE_API_BASE=/IntelliDocs/public      (XAMPP, project under htdocs/IntelliDocs)
 *   VITE_API_BASE=/public                  (project at htdocs root)
 *   VITE_API_BASE=                         (CI4 served at /, e.g. via `php spark serve` directly)
 *
 * The proxy target host can also be overridden:
 *   VITE_API_TARGET=http://127.0.0.1       (XAMPP Apache, default)
 *   VITE_API_TARGET=http://127.0.0.1:8080  (CI4 spark serve)
 */
/** Production build asset prefix — must match Apache/nginx public URL (see deploy_local.ps1 / deploy_droplet.sh). */
function resolveViteBase(env: Record<string, string>): string {
  const explicit = (env.VITE_APP_BASE ?? '').trim();
  if (explicit) {
    return explicit.endsWith('/') ? explicit : `${explicit}/`;
  }
  const apiBase = (env.VITE_API_BASE ?? '').trim();
  if (!apiBase) {
    return '/';
  }
  return apiBase.endsWith('/') ? apiBase : `${apiBase}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const phpPublicBase = env.VITE_API_BASE || '/IntelliDocs/public';
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1';

  return {
  // Dev server stays at / ; production build uses subpath on XAMPP or / on droplet.
  base: mode === 'production' ? resolveViteBase(env) : '/',
  plugins: [tailwindcss(), figmaAssetPlugin(), react()],
  server: {
    host: '127.0.0.1',
    port: 3001,
    strictPort: false,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (reqPath) => phpPublicBase + reqPath,
      },
      '/IntelliDocs/public/uploads': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (reqPath) => phpPublicBase + reqPath,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
    },
  },
};
});
