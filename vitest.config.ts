import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Local review checkouts under .tmp are not part of this project's test suite.
export default defineConfig({plugins:[react()],test:{include:['tests/unit/**/*.test.{ts,tsx}']}});
