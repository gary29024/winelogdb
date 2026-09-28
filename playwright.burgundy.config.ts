import {defineConfig,devices} from '@playwright/test';

// Reproducible focused validation on both engines without the unrelated flows.
// WINELOG_E2E_EXHAUSTIVE_MAPS=1 covers every registered lossless map/format.
export default defineConfig({
 testDir:'tests/e2e',testMatch:'burgundy-village-map.spec.ts',grep:/Lossless detailed/,
 fullyParallel:true,workers:2,forbidOnly:!!process.env.CI,retries:0,
 reporter:[['list'],['json',{outputFile:'.cache/test-reports/burgundy-browser.json'}]],
 use:{baseURL:'http://127.0.0.1:5179',trace:'retain-on-failure'},
 webServer:{command:'npm run dev -- --mode test --host 127.0.0.1 --port 5179 --strictPort',port:5179,reuseExistingServer:false},
 projects:[
  {name:'chromium',use:{browserName:'chromium'}},
  {name:'mobile-webkit',use:{...devices['iPhone 15 Pro'],browserName:'webkit'}},
 ],
});
