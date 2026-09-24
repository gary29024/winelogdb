import { defineConfig } from '@playwright/test';

// Separate from the fast API-mocked UI suite: every WineLog request reaches workerd.
export default defineConfig({
  testDir: 'tests/stack',
  outputDir: 'test-results/stack',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: { browserName: 'chromium', trace: 'retain-on-failure', actionTimeout: 15_000 },
});
