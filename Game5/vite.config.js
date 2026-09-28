import { defineConfig } from 'vite';

// Game assets live in ./assets and are served/copied as static files.
export default defineConfig({
  base: './',
  publicDir: 'assets',
  build: { chunkSizeWarningLimit: 2000 },
});
