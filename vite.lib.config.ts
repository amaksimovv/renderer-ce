import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'SeatmapCE',
      formats: ['es', 'umd'],
      fileName: (format) => `renderer-ce.${format === 'es' ? 'js' : 'cjs'}`,
    },
  },
});
