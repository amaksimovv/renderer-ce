import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './tests/global-setup.ts',
  testDir: 'tests',
  outputDir: process.env.RENDERER_CE_ARTIFACTS ?? '.ai-runtime/renderer-ce/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:3010',
    trace: 'retain-on-failure',
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'yarn build && yarn build:demo && yarn preview',
    url: 'http://127.0.0.1:3010',
    reuseExistingServer: !process.env.CI,
  },
});
