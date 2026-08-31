import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig({
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
  resolve: {
    alias: {
      '@pirate/coeur-jeu': fileURLToPath(
        new URL('../../packages/coeur-jeu/src/index.ts', import.meta.url),
      ),
      '@pirate/protocole': fileURLToPath(
        new URL('../../packages/protocole/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
