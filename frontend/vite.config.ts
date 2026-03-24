import { defineConfig, type Plugin } from 'vite';
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

/** XAMPP: project lives under htdocs/IntelliDocs; API is served from the `public` folder via index.php → api_index.php */
const PHP_PUBLIC_BASE = '/IntelliDocs/public';

export default defineConfig({
  plugins: [tailwindcss(), figmaAssetPlugin(), react()],
  server: {
    host: '127.0.0.1',
    port: 3001,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1',
        changeOrigin: true,
        secure: false,
        rewrite: (reqPath) => PHP_PUBLIC_BASE + reqPath,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
    },
  },
});
