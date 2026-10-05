import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./tests',timeout:45000,workers:1,fullyParallel:false,
  use:{baseURL:'http://127.0.0.1:3000',trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 7']}}],
  reporter:'list'});
