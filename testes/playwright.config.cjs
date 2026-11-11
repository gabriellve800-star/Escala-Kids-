const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'.',
 testMatch:'qa-ui.spec.cjs',
 timeout:60000,
 expect:{timeout:20000},
 fullyParallel:false,
 workers:1,
 retries:0,
 reporter:[['list']],
 use:{baseURL:'http://localhost:4173/',trace:'off',screenshot:'off',video:'off'},
 projects:[
  {name:'android-chrome',use:{...devices['Pixel 7'],browserName:'chromium'}},
  {name:'iphone-webkit',use:{...devices['iPhone 13'],browserName:'webkit'}}
 ]
});
