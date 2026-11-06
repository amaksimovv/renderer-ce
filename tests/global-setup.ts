import { build } from 'vite';
import path from 'node:path';

export const fixturePath = path.resolve(
  process.env.RENDERER_CE_ARTIFACTS ?? '.ai-runtime/renderer-ce/e2e',
  '../fixtures/internal.cjs',
);

export default async function setup(): Promise<void> {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'error',
    build: {
      outDir: path.dirname(fixturePath),
      lib: {
        entry: 'tests/internal-fixture.ts',
        name: 'SeatmapCE',
        formats: ['iife'],
        fileName: () => 'internal.cjs',
      },
    },
  });
}
