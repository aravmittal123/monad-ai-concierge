'use client';
import {useState} from 'react';
import {Fingerprint,KeyRound,LoaderCircle,ScanLine} from 'lucide-react';
import type {RuntimeConfig} from '@/lib/types';
import {friendlyError} from '@/lib/api';
import {loginPasskey,type WalletSession} from '@/lib/smart-account';
const demoAddress='0xdA6bEa0b5FCc4A3e46075f68E247f17d13A0899e';
export default function PasskeyLogin({config,setupError,onLogin,onObserve,onBusy}:{config:RuntimeConfig|null;setupError?:string;onLogin:(wallet:WalletSession)=>void;onObserve:(address:string)=>void;onBusy?:(busy:boolean)=>void}) {
  const [name,setName]=useState('My Monad account'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function connect(register:boolean){if(!config)return;setBusy(true);onBusy?.(true);setError('');
    try{onLogin(await loginPasskey(name,register,config));}catch(e){setError(friendlyError(e));}finally{setBusy(false);onBusy?.(false);}}
  return <div className="login-card"><div className="login-icon"><Fingerprint size={38}/></div><p>Create a wallet with your device’s passkey, or log in to your existing account.</p>
    <label className="field-label" htmlFor="account-name">Account name</label><input id="account-name" maxLength={40} value={name} onChange={e=>setName(e.target.value)} className="text-field" disabled={busy}/>
    <button className="button primary wide" disabled={busy||!config?.wallet_configured||!name.trim()} onClick={()=>connect(true)}>{busy?<LoaderCircle className="spin" size={18}/>:<Fingerprint size={18}/>} Create Account</button>
    <button className="button secondary wide" disabled={busy||!config?.wallet_configured} onClick={()=>connect(false)}><KeyRound size={16}/> Log In</button>
    {!config&&<div className="notice">{setupError?'Wallet setup could not load. Retry the connection.':'Checking wallet setup…'}</div>}
    {config&&!config.wallet_configured&&<div className="notice">Passkey sign-in is not configured yet. You can try the public demo account.</div>}
    {error&&<div role="alert" className="error-box">{error}</div>}
    <div className="login-footnote">Your passkey stays with your device or passkey provider.</div>
    <button className="button secondary wide" disabled={busy} onClick={()=>onObserve(demoAddress)}><ScanLine size={16}/> Try Demo Account</button>
    <small className="demo-account-note">Real chain data · read only · cannot send funds</small>
  </div>;
}
