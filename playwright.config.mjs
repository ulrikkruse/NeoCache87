import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',testMatch:'**/*.spec.mjs',fullyParallel:true,
 timeout:30000,expect:{timeout:5000},retries:0,workers:2,
 reporter:[['list'],['html',{outputFolder:'.playwright-report',open:'never'}]],
 outputDir:'.test-results',
 use:{baseURL:'http://127.0.0.1:4187',serviceWorkers:'block',reducedMotion:'reduce',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'chromium-desktop',use:{...devices['Desktop Chrome']}},{name:'webkit-mobile',use:{...devices['iPhone 13']}}],
 webServer:{command:'node scripts/test-server.mjs',url:'http://127.0.0.1:4187/index.html',reuseExistingServer:false,timeout:15000}
});
