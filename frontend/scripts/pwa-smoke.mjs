import {chromium} from '@playwright/test';
const base=process.env.APP_URL||'http://127.0.0.1:3001';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();const page=await context.newPage();
 const response=await page.goto(base);
 if(!response?.headers()['permissions-policy']?.includes('microphone=(self)'))throw new Error('Microphone policy does not allow user-initiated dictation.');
 const manifest=await (await context.request.get(base+'/manifest.webmanifest')).json();
 if(manifest.display!=='standalone'||!manifest.icons.some(i=>i.sizes==='512x512'))throw new Error('Incomplete install manifest');
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{},{timeout:30000});
 const cached=await page.evaluate(async()=>{const names=await caches.keys();const urls=[];for(const name of names){const cache=await caches.open(name);urls.push(...(await cache.keys()).map(r=>new URL(r.url).pathname));}return urls;});
 if(cached.some(path=>path.startsWith('/api/')))throw new Error('Sensitive API data must never be cached');
 if(!cached.includes('/offline.html'))throw new Error('Offline fallback missing');
 await context.setOffline(true);await page.goto(base+'/');
 if(!await page.getByRole('heading',{name:'You’re offline.'}).isVisible())throw new Error('Offline page missing');
 if(await page.getByRole('button',{name:'Send message'}).count())throw new Error('Offline fallback must not expose transaction submission');
 console.log('PASS: manifest/icons, service-worker activation, network-only API policy, offline fallback and microphone policy.');
 console.log('Physical Android/iOS installation and passkeys are not simulated by this check.');
}finally{await browser.close();}
