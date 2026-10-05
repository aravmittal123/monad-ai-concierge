import {chromium,devices} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const base=process.env.APP_URL||'https://monad-ai-concierge.vercel.app';
mkdirSync('screenshots',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 for(const [name,options] of [['desktop',{viewport:{width:1280,height:820}}],['mobile',devices['Pixel 7']]]) {
  const context=await browser.newContext(options);
  const page=await context.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByText('Live chain data',{exact:true}).waitFor();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error(`${name}: horizontal overflow`);
  await page.screenshot({path:`screenshots/production-${name}.png`,fullPage:true});
  if(name==='desktop') {
   await page.getByRole('button',{name:'Explore a public account'}).click();
   await page.getByPlaceholder('0x…').fill('0xdA6bEa0b5FCc4A3e46075f68E247f17d13A0899e');
   await page.getByRole('button',{name:'View real chain data'}).click();
   await page.getByRole('textbox',{name:'Ask Monad'}).fill('Check my balance');
   await page.getByRole('button',{name:'Send message'}).click();
   await page.getByText(/^Your balance is [0-9.]+ MON\.$/).waitFor({timeout:65000});
   await page.screenshot({path:'screenshots/production-balance.png',fullPage:true});
  }
  if(errors.length)throw new Error(`${name}: ${errors.join(', ')}`);
  console.log(`PASS ${name}: live page, no horizontal overflow or browser errors`);
  await context.close();
 }
}finally{await browser.close();}
