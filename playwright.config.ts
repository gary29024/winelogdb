import { defineConfig,devices } from '@playwright/test';

export default defineConfig({
  testDir:'tests/e2e',
  fullyParallel:true,
  forbidOnly:!!process.env.CI,
  workers:process.env.CI?2:4,
  retries:0,
  reporter:process.env.CI?[['list'],['html',{open:'never'}]]:'list',
  webServer:{
    command:'npm run dev -- --mode test --host 127.0.0.1 --strictPort',
    port:5173,
    reuseExistingServer:!process.env.CI,
  },
  use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure'},
  projects:[
    {name:'chromium',testIgnore:'**/iphone-layout.spec.ts',use:{browserName:'chromium'}},
    ...['iPhone 15 Pro','iPhone 15 Pro Max'].map(name=>({
      name,testMatch:'**/iphone-layout.spec.ts',use:{...devices[name],browserName:'webkit' as const},
    })),
  ],
});
