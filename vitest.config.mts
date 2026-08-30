import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

const racine = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@pirate/protocole': resolve(racine, 'packages/protocole/src/index.ts'),
      '@pirate/coeur-jeu': resolve(racine, 'packages/coeur-jeu/src/index.ts'),
      '@pirate/support-tests': resolve(racine, 'packages/support-tests/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
    reporters: ['default'],
  },
});
