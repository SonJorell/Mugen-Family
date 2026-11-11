import { defineConfig } from 'vite';

// BASE_PATH sets where the build is served from, e.g. "/Mugen-Family/" for GitHub Pages.
// Without it the build uses relative paths and works from any site root.
export default defineConfig({
  base: process.env.BASE_PATH || './',
  server: {
    port: 3000,
    open: false,
    host: true,
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ['**/*.mp4', '**/dist/**', '**/.git/**'],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
