import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Local review checkouts under .tmp are not part of this project's test suite.
export default defineConfig({
  plugins:[react()],
  test:{
    include:['tests/unit/**/*.test.{ts,tsx}'],
    // Keep per-file isolation; threads avoid a fresh OS process for each file.
    pool:'threads',
    globalSetup:['tests/unit/support/databaseSetup.ts'],
    forceRerunTriggers:['**/vitest.config.*','src/lib/db/migrations/**'],
    allowOnly:!process.env.CI,
  },
});
