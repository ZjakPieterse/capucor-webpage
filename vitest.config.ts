import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Unit tests receive only the environment explicitly provided by the caller.
  // Vite otherwise discovers and reads .env.local before test collection, which
  // both crosses the sandbox credential boundary and makes an offline gate depend
  // on developer-only secrets it does not use.
  //
  // ⚠️ Same reasoning as ../capucor-os/vitest.config.mts (AE-01), and the same
  // reason npm run build:cf:offline exists: verification here must not need a
  // credential it does not use.
  envDir: false,
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
