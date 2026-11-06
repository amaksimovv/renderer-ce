import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 3010, strictPort: true },
  preview: { port: 3010, strictPort: true },
  build: { outDir: 'dist-demo', assetsInlineLimit: 0 },
});
