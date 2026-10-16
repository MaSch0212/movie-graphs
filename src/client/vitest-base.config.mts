import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The app is zoneless, so zone.js is not installed. Angular's test setup only imports
      // `zone.js/testing` when zone.js is loaded, but Vite still tries to resolve the import.
      'zone.js/testing': fileURLToPath(new URL('./tools/vitest/empty-module.mjs', import.meta.url)),
    },
  },
});
