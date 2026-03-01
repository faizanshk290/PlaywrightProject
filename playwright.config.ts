import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  reporter: 'html',
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    navigationTimeout: 30000,
    video: 'off',
    screenshot: 'only-on-failure',
    bypassCSP: true,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { slowMo: 500 } },
    },
  ],
});
