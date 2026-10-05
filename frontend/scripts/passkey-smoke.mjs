// Opt-in live provider test. Creates an unfunded diagnostic passkey/account using
// Chromium's virtual authenticator, then checks recovery. Never sends transactions.
import {chromium} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const base=process.env.APP_URL||'http://localhost:3000';
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext();
 const page=await context.newPage();
 const cdp=await context.newCDPSession(page);
 await cdp.send('WebAuthn.enable');
 await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,
  hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
 page.on('response',async response=>{
  try {
  const url=new URL(response.url());
  if(url.pathname.startsWith('/api/passkeys/')||url.pathname==='/api/rpc')console.log('HTTP',response.status(),url.pathname);
  if(url.pathname==='/api/passkeys/register/verify'){
   const result=await response.json();console.log('Provider registration verified:',result.verified===true);
  }
  if(url.pathname==='/api/rpc'){
   const result=await response.json();console.log('RPC method:',response.request().postDataJSON()?.method,'error code:',result.error?.code??'none');
  }
  } catch { /* A diagnostic response may finish after navigation; assertions below determine acceptance. */ }
 });
 page.on('request',request=>{
  if(new URL(request.url()).pathname==='/api/passkeys/register/verify')console.log('Authenticator key algorithm:',request.postDataJSON()?.cred?.response?.publicKeyAlgorithm);
 });
 await page.goto(base,{waitUntil:'networkidle'});
 const config=await (await context.request.get(`${base}/api/config`)).json();
 if(!config.wallet_configured)throw new Error('Wallet project URLs are not configured in this running app.');
 await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();
 await page.locator('#account-name').fill(`Diagnostic ${randomUUID().slice(0,8)}`);
 await page.getByRole('button',{name:'Create Account',exact:true}).click();
 await page.waitForFunction(()=>Boolean(document.querySelector('.account-pill'))||Boolean(document.querySelector('.login-card [role=alert]')),{},{timeout:60000});
 const alert=await page.locator('.login-card [role=alert]').count()?await page.locator('.login-card [role=alert]').textContent():null;
 if(alert)throw new Error(`Registration failed: ${alert}`);
 const first=await page.locator('.account-pill').innerText();
 console.log('PASS: live passkey registration and smart-account construction (virtual authenticator).');
 await page.getByRole('button',{name:'Disconnect',exact:true}).click();
 await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();
 await page.getByRole('button',{name:'Log In',exact:true}).click();
 await page.waitForFunction(()=>Boolean(document.querySelector('.account-pill'))||Boolean(document.querySelector('.login-card [role=alert]')),{},{timeout:60000});
 const loginAlert=await page.locator('.login-card [role=alert]').count()?await page.locator('.login-card [role=alert]').textContent():null;
 if(loginAlert)throw new Error(`Recovery failed: ${loginAlert}`);
 if(first!==await page.locator('.account-pill').innerText())throw new Error('Recovery returned a different account.');
 console.log('PASS: live passkey recovery returned the same smart account. No funds or transactions used.');
}finally{await browser.close();}
