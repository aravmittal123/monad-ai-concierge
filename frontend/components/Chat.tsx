'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowUp,ArrowUpRight,BookOpen,Check,Copy,Flame,FlaskConical,LoaderCircle,Lock,Plus,Send,ShieldCheck,Sparkles,Wallet,X} from 'lucide-react';
import Header from './Header';
import PasskeyLogin from './PasskeyLogin';
import MessageBubble,{type Message} from './MessageBubble';
import TransactionPreview from './TransactionPreview';
import LiveNetwork from './LiveNetwork';
import Contacts from './Contacts';
import ActivityFeed from './ActivityFeed';
import VoiceInput from './VoiceInput';
import InstallApp from './InstallApp';
import TrustBadge from './TrustBadge';
import PromptExamples from './PromptExamples';
import {api,ApiError,friendlyError} from '@/lib/api';
import {decimalLabel,shortAddress} from '@/lib/monad';
import {loadActivity,loadContacts} from '@/lib/local-data';
import {confirm,estimate,type WalletSession,type WalletEstimate} from '@/lib/smart-account';
import type {Activity,ChatResponse,ChainData,Contact,Intent,Prepared,RuntimeConfig,Step} from '@/lib/types';
import {parseGwei} from 'viem';
const chips=[{icon:Wallet,label:'My balance',prompt:'Check my balance'},{icon:Flame,label:'Live gas',prompt:'Check gas'},
 {icon:Send,label:'Send MON',prompt:'Send 0.01 MON to Father'},{icon:FlaskConical,label:'Demo swap',prompt:'Swap 1 MON to USDC'}];
type Notice={id:string;text:string;error:boolean};
export default function Chat(){
 const [config,setConfig]=useState<RuntimeConfig|null>(null),[online,setOnline]=useState(false),[setupError,setSetupError]=useState('');
 const [wallet,setWallet]=useState<WalletSession|null>(null),[observer,setObserver]=useState('');const address=wallet?.address??observer;
 const [connectOpen,setConnectOpen]=useState(false),[connecting,setConnecting]=useState(false),[menuOpen,setMenuOpen]=useState(false);
 const [theme,setTheme]=useState<'dark'|'light'>('dark'),[contacts,setContacts]=useState<Contact[]>([]),[activity,setActivity]=useState<Activity[]>([]);
 const [messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[data,setData]=useState<ChainData|null>(null);
 const [prepared,setPrepared]=useState<Prepared|null>(null),[queued,setQueued]=useState<Intent|null>(null),[steps,setSteps]=useState<Step[]>([]);
 const [walletEstimate,setWalletEstimate]=useState<WalletEstimate|null>(null),[estimating,setEstimating]=useState(false),[approving,setApproving]=useState(false);
 const [previewError,setPreviewError]=useState(''),[gasRule,setGasRule]=useState(''),[sponsor,setSponsor]=useState(false),[submission,setSubmission]=useState('');
 const [notices,setNotices]=useState<Notice[]>([]),[status,setStatus]=useState(''),[copied,setCopied]=useState(false);
 const inputRef=useRef<HTMLTextAreaElement>(null),bottom=useRef<HTMLDivElement>(null),actionLock=useRef(false),noticeTimers=useRef<ReturnType<typeof setTimeout>[]>([]);
 const blocked=busy||approving||Boolean(prepared)||Boolean(queued);
 const notify=useCallback((text:string,error=false)=>{const id=crypto.randomUUID();setNotices(n=>n.some(item=>item.text===text)?n:[...n.slice(-1),{id,text,error}]);noticeTimers.current.push(setTimeout(()=>setNotices(n=>n.filter(x=>x.id!==id)),error?9000:5500));},[]);
 const loadConfig=useCallback(async()=>{setSetupError('');try{setConfig(await api<RuntimeConfig>('config'));}catch(e){const text=friendlyError(e);setSetupError(text);notify(text,true);}},[notify]);
 useEffect(()=>{void loadConfig();setContacts(loadContacts());try{if(localStorage.getItem('concierge.theme')==='light')setTheme('light');}catch{}
   const incoming=new URLSearchParams(location.search).get('intent');if(incoming)setInput(incoming.slice(0,2000));
   return()=>{noticeTimers.current.forEach(clearTimeout);};},[loadConfig]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('concierge.theme',theme);}catch{}},[theme]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();inputRef.current?.focus();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'});},[messages,busy,steps]);
 useEffect(()=>{let cancelled=false;setData(null);setActivity(address?loadActivity(address):[]);if(address)api<ChainData>('account',{prompt:'Read account',wallet_address:address})
   .then(d=>{if(!cancelled)setData(d);}).catch(e=>{if(!cancelled)notify(friendlyError(e),true);});return()=>{cancelled=true;};},[address,notify]);
 function add(role:Message['role'],text:string,error=false,extra:Partial<Message>={}){setMessages(m=>[...m,{id:crypto.randomUUID(),role,text,error,...extra}]);}
 function record(item:Activity){const next=[item,...activity.filter(x=>x.id!==item.id)].slice(0,50);setActivity(next);try{localStorage.setItem(`concierge.activity.v1.${item.account.toLowerCase()}`,JSON.stringify(next));}catch{notify('Browser storage is unavailable. Activity will last only for this session.');}}
 function saveContacts(next:Contact[]){setContacts(next);try{localStorage.setItem('concierge.contacts.v1',JSON.stringify(next));}catch{notify('Contacts are available for this session only; browser storage is blocked.',true);}}
 function disconnect(){if(actionLock.current)return;setWallet(null);setObserver('');setMessages([]);setPrepared(null);setQueued(null);setSteps([]);setSubmission('');setSponsor(false);}
 async function copy(){try{await navigator.clipboard.writeText(address);setCopied(true);setTimeout(()=>setCopied(false),1500);}catch{notify(`Your address: ${address}`);}}
 function fill(value:string){setInput(value);setMenuOpen(false);inputRef.current?.focus();}
 async function prepare(intentInput:Intent){
   if(activity.some(a=>a.status==='pending'))throw new ApiError('pending_operation','An earlier operation is still pending. Check its receipt in Recent Activity before sending another.');
   const intent=structuredClone(intentInput);
   if(gasRule){if(!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,9})?$/.test(gasRule)||parseGwei(gasRule)<=0n)throw new ApiError('invalid_gas_rule','Enter a positive gas price in gwei.');
     if(!intent.params.max_gas_price_gwei||parseGwei(gasRule)<parseGwei(intent.params.max_gas_price_gwei))intent.params.max_gas_price_gwei=gasRule;}
   const preview=await api<Prepared>('prepare',{intent,wallet_address:address,contacts,slippage_bps:50});
   setPrepared(preview);setPreviewError('');setWalletEstimate(null);setSubmission('');setQueued(null);
   if(!wallet){setPreviewError('This account is read only. Connect your passkey wallet to approve.');return;}
   if(preview.preview.mode!=='mock'){setEstimating(true);setStatus('Estimating the full wallet fee');try{setWalletEstimate(await estimate(wallet,preview.preview,sponsor));}catch(e){setPreviewError(friendlyError(e));notify(friendlyError(e),true);}finally{setEstimating(false);}}
 }
 async function send(prompt=input){
   if(actionLock.current||!prompt.trim()||prepared||queued)return;
   if(!address){setConnectOpen(true);return;}
   actionLock.current=true;setBusy(true);setInput('');setStatus('Understanding your request');setSteps([]);add('user',prompt.trim());
   try{const response=await api<ChatResponse>('chat',{prompt:prompt.trim(),wallet_address:address,contacts});
     if(response.chain_data)setData(response.chain_data);
     add('assistant',response.message,false,{data:response.type==='information'?response.chain_data:undefined,intentSource:response.intent_source});
     if(response.steps)setSteps(response.steps);
     if(response.type==='action_plan'&&response.plan){if(response.needs_step_confirmation){setQueued(response.plan.intent);}else{setStatus('Checking recipient, balance and safeguards');await prepare(response.plan.intent);}}
   }catch(e){notify(friendlyError(e),true);}finally{setBusy(false);setStatus('');actionLock.current=false;}
 }
 async function continueWorkflow(){if(!queued||actionLock.current)return;actionLock.current=true;setBusy(true);setStatus('Rechecking the balance condition');try{await prepare(queued);setSteps(s=>s.map(x=>({...x,status:'complete'})));}catch(e){notify(friendlyError(e),true);setQueued(null);setSteps(s=>s.map((x,i)=>i===2?{...x,status:'blocked'}:x));}finally{actionLock.current=false;setBusy(false);setStatus('');}}
 async function retryEstimate(){if(!wallet||!prepared||actionLock.current||submission)return;actionLock.current=true;setEstimating(true);setPreviewError('');try{
   await api('revalidate',{wallet_address:wallet.address,preview_token:prepared.preview_token});
   setWalletEstimate(await estimate(wallet,prepared.preview,sponsor));
 }catch(e){setWalletEstimate(null);setPreviewError(friendlyError(e));}finally{setEstimating(false);actionLock.current=false;}}
 function activityTitle(p:Prepared['preview']){return p.action==='transfer'?`Send ${p.amount} ${p.token} to ${p.recipient_name||shortAddress(p.recipient||'')}`:`Swap ${p.amount_mon} MON to USDC`;}
 async function approve(){
   if(!wallet||!prepared||actionLock.current||estimating||submission)return;
   actionLock.current=true;setApproving(true);setPreviewError('');const p=prepared.preview;
   const entry:Activity={id:p.preview_id,account:wallet.address,title:activityTitle(p),status:'pending',time:Date.now(),recipient:p.recipient||undefined};let hash:`0x${string}`|undefined;
   try{const result=await confirm(wallet,prepared,walletEstimate,h=>{hash=h;setSubmission(h);record({...entry,userOpHash:h});});
     record({...entry,status:result.kind==='rehearsal'?'demo-approved':'confirmed',...(result.kind==='transaction'?{hash:result.hash,userOpHash:result.userOpHash}:{})});
     add('assistant',result.kind==='rehearsal'?'Swap simulation approved. Your balances are unchanged.':p.action==='transfer'?'Your transfer was confirmed on Monad Testnet.':'Your swap was confirmed on Monad Testnet.',false,{result});
     setPrepared(null);setWalletEstimate(null);setSteps([]);
     api<ChainData>('account',{prompt:'Refresh balance',wallet_address:wallet.address}).then(setData).catch(()=>{});
   }catch(e){const text=friendlyError(e);setPreviewError(text);notify(text,true);if(hash){const failed=e instanceof ApiError&&e.code==='transaction_reverted';record({...entry,status:failed?'failed':'pending',userOpHash:hash});add('assistant',text,true,{pendingHash:hash});}}
   finally{setApproving(false);actionLock.current=false;}
 }
 async function checkReceipt(item:Activity){if(!wallet||!item.userOpHash){notify('Log in to this account to check its pending operation.');return;}try{const receipt=await wallet.client.getUserOperationReceipt({hash:item.userOpHash});
   if(!receipt){notify('Still pending. Do not send the same payment again.');return;}const ok=receipt.success&&receipt.receipt.status==='success';record({...item,status:ok?'confirmed':'failed',hash:receipt.receipt.transactionHash});notify(ok?'Receipt confirmed':'Operation reverted',!ok);
 }catch{notify('Receipt not available yet. Check again later; do not resend.');}}
 function cancel(){if(approving)return;if(prepared&&!submission)record({id:prepared.preview.preview_id,account:address,title:activityTitle(prepared.preview),status:'cancelled',time:Date.now()});setPrepared(null);setWalletEstimate(null);setSteps([]);if(submission)notify('Operation is still recorded in Recent Activity. Check its receipt before sending again.');}
 return <div className="app-shell"><div className="ambient-glow" aria-hidden="true"/><Header address={address||undefined} observer={Boolean(observer)} onLogout={disconnect} onCopy={copy} onConnect={()=>{if(!actionLock.current)setConnectOpen(true);}} onMenu={()=>setMenuOpen(!menuOpen)} theme={theme} onTheme={()=>setTheme(t=>t==='dark'?'light':'dark')}/>
  <div className="workspace">{menuOpen&&<button className="sidebar-scrim" aria-label="Close sidebar" onClick={()=>setMenuOpen(false)}/>}
  <aside className={`sidebar glass ${menuOpen?'is-open':''}`} aria-label="Wallet sidebar"><button className="new-chat" disabled={blocked} onClick={()=>{setMessages([]);setSteps([]);fill('');}}><Plus size={16}/> New conversation <kbd>Ctrl K</kbd></button>
   <section className="wallet-panel glass"><div className="section-heading"><span><Wallet size={15}/>{observer?'Demo account':address?'My account':'Account'}</span>{address&&<span className="green-dot"/>}</div>
    {address?<><strong className={`balance-value ${!data?'skeleton':''}`}>{data?decimalLabel(data.balance_mon):'…'} <span>MON</span></strong><button className="wallet-address" onClick={copy}>{shortAddress(address)}{copied?<Check size={13}/>:<Copy size={13}/>}</button>
     <TrustBadge address={address} registry={config?.activity_registry_address} revision={activity.filter(a=>a.status==='confirmed').length}/><a className="faucet-link" href="https://faucet.monad.xyz" target="_blank" rel="noopener noreferrer">Get testnet MON <ArrowUpRight size={13}/></a>
     <a className="faucet-link" href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">Get testnet USDC <ArrowUpRight size={13}/></a>
     <Contacts contacts={contacts} onChange={saveContacts} onSend={c=>fill(`Send 0.01 MON to ${c.name}`)} disabled={blocked}/></>:<><p className="not-connected">Not connected</p><button className="button secondary wide" onClick={()=>setConnectOpen(true)}>Connect Wallet</button></>}
   </section>
   <LiveNetwork onStatus={setOnline}/>
   <ActivityFeed items={activity} onCheck={checkReceipt}/>
   <div className="sidebar-bottom"><a href="/demo-guide" className="icon-button" title="Demo guide" aria-label="Demo guide"><BookOpen size={16}/></a><InstallApp onNotice={notify}/></div>
  </aside>
  <main className="main"><div className="main-topbar"><span className="topbar-badge"><span className={online?'green-dot':'amber-dot'}/>{online?'Live':'Reconnecting'}</span>{observer&&<span>Read-only demo account</span>}{setupError&&<button className="text-button" onClick={()=>void loadConfig()}>Retry connection</button>}</div>
   <div className={`chat-scroll ${messages.length?'with-messages':''}`}>
    {!messages.length?<div className="welcome"><div className="welcome-symbol"><Sparkles size={28}/></div><h1>What&apos;s your next move?</h1><p>Talk to your wallet. Approve with a touch.</p><div className="quick-actions">{chips.map(c=><button className="quick-chip glass" key={c.label} disabled={blocked} onClick={()=>fill(c.prompt)}><c.icon size={16}/>{c.label}</button>)}</div><button className="workflow-example" onClick={()=>fill('Check my balance, and if I have more than 5 MON, swap 2 to USDC')} disabled={blocked}>Try a two-step request <ArrowUpRight size={13}/></button></div>:
    <div className="messages">{messages.map(m=><MessageBubble key={m.id} message={m}/>)}{steps.length>0&&<div className="workflow-card glass" aria-label="Workflow progress">{steps.map((s,i)=><div key={s.title} className={`workflow-step step-${s.status}`}><span>{s.status==='complete'?<Check size={14}/>:i+1}</span><p>{s.title}<small>{s.status}</small></p></div>)}{queued&&<div className="workflow-actions"><button className="button secondary" onClick={()=>{setQueued(null);setSteps([]);}} disabled={busy}>Cancel workflow</button><button className="button primary" onClick={()=>void continueWorkflow()} disabled={busy}>Continue to preview</button></div>}</div>}
    {busy&&<div className="thinking" role="status"><span className="thinking-dot"/><span className="thinking-dot"/><span className="thinking-dot"/><span>{status||'Thinking…'}</span></div>}<div ref={bottom}/></div>}
   </div>
   <div className="composer-area">{address&&<details className="safeguard-options"><summary><ShieldCheck size={13}/> Safeguards & sponsorship</summary><div className="safeguard-fields"><label>Gas limit (gwei)<input value={gasRule} onChange={e=>setGasRule(e.target.value)} placeholder="Optional" inputMode="decimal" disabled={blocked}/></label><label className="sponsor-toggle"><input type="checkbox" checked={sponsor} onChange={e=>setSponsor(e.target.checked)} disabled={!wallet||!config?.sponsorship||blocked}/>Request gas sponsorship</label><small>{config?.sponsorship?'Confirmed sponsorship appears in the fee preview.':'Sponsorship is not configured. Transfers require MON for fees.'}</small></div></details>}
    <form className="composer glass" onSubmit={e=>{e.preventDefault();void send();}}><textarea ref={inputRef} aria-label="Ask Monad" placeholder="Ask your wallet anything…" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} maxLength={2000} rows={2} disabled={blocked}/>
    <div className="composer-bottom"><span className="composer-hint"><PromptExamples onSelect={fill} disabled={blocked}/><span title="Every transfer needs your explicit passkey approval"><Lock size={12}/></span></span><div className="composer-buttons"><VoiceInput disabled={blocked} onText={fill}/><button className="send-button" type="submit" disabled={!input.trim()||blocked} aria-label="Send message">{busy?<LoaderCircle size={20} className="spin"/>:<ArrowUp size={21}/>}</button></div></div></form>
    <footer className="composer-note">Testnet only {config?.swap_mode==='mock'&&<><span>·</span><span className="demo-badge" title="Swap simulations do not move funds"><FlaskConical size={12}/> Demo swaps</span></>}</footer>
   </div>
  </main></div>
  <Dialog.Root open={connectOpen} onOpenChange={v=>{if(!connecting)setConnectOpen(v);}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="preview-dialog connect-dialog" onEscapeKeyDown={e=>{if(connecting)e.preventDefault();}} onPointerDownOutside={e=>{if(connecting)e.preventDefault();}}><div className="modal-heading"><Dialog.Title>Connect your wallet</Dialog.Title><Dialog.Close className="icon-button" aria-label="Close wallet dialog" disabled={connecting}><X size={18}/></Dialog.Close></div><Dialog.Description className="sr-only">Use a passkey or explore a read-only public account.</Dialog.Description>
   <PasskeyLogin config={config} setupError={setupError} onBusy={setConnecting} onLogin={w=>{setWallet(w);setObserver('');setConnectOpen(false);}} onObserve={a=>{setObserver(a);setWallet(null);setConnectOpen(false);}}/>{setupError&&<button className="text-button" onClick={()=>void loadConfig()}>Retry connection</button>}
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  {prepared&&<TransactionPreview prepared={prepared} estimate={walletEstimate} busy={approving||estimating} estimating={estimating} canConfirm={Boolean(wallet)&&!estimating&&!previewError&&!submission&&(prepared.preview.mode==='mock'||Boolean(walletEstimate))} onCancel={cancel} onConfirm={approve} onRetry={wallet&&!submission&&prepared.preview.mode!=='mock'?()=>void retryEstimate():undefined} error={previewError}/>}
  <div className="toast-stack" aria-live="polite">{notices.map(n=><div className={`toast ${n.error?'toast-error':'toast-success'}`} key={n.id} role={n.error?'alert':'status'}><span>{n.text}</span><button className="icon-button" aria-label="Dismiss notification" onClick={()=>setNotices(v=>v.filter(x=>x.id!==n.id))}><X size={14}/></button></div>)}</div>
 </div>;
}
