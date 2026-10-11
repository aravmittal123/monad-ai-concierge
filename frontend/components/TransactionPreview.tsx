'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {ArrowDown,Check,Fingerprint,LoaderCircle,ShieldCheck,X} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import type {Prepared} from '@/lib/types';
import type {WalletEstimate} from '@/lib/smart-account';
export default function TransactionPreview({prepared,estimate,busy,estimating=false,canConfirm,onCancel,onConfirm,onRetry,error,speechControls}:{prepared:Prepared;estimate:WalletEstimate|null;
  busy:boolean;estimating?:boolean;canConfirm:boolean;onCancel:()=>void;onConfirm:()=>void;onRetry?:()=>void;error:string;speechControls?:ReactNode}) {
  const p=prepared.preview;const [seconds,setSeconds]=useState(Math.max(0,p.expires_at-Math.floor(Date.now()/1000)));
  const [recipientChecked,setRecipientChecked]=useState(false);const transfer=p.action==='transfer';
  useEffect(()=>{const timer=setInterval(()=>setSeconds(Math.max(0,p.expires_at-Math.floor(Date.now()/1000))),1000);return()=>clearInterval(timer);},[p.expires_at]);
  return <Dialog.Root open onOpenChange={open=>{if(!open&&!busy)onCancel();}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/>
    <Dialog.Content className="preview-dialog" aria-describedby="preview-description" onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onPointerDownOutside={e=>e.preventDefault()}>
      <div className="preview-heading"><span className="eyebrow"><ShieldCheck size={13}/> YOU ARE IN CONTROL</span><button className="icon-button" onClick={onCancel} disabled={busy} aria-label="Close preview"><X size={18}/></button></div>
      <Dialog.Title>{transfer?'Review your transfer':'Review your swap'}</Dialog.Title><Dialog.Description id="preview-description">{transfer?'REAL TESTNET TRANSFER · tokens will leave your account':p.mode==='mock'?'Demo Mode · no real funds move':'REAL TESTNET SWAP · MON will be exchanged for USDC'}</Dialog.Description>
      <div className="swap-amount"><div><span>You {p.mode==='mock'?'would pay':'send'}</span><strong>{transfer?p.amount:p.amount_mon} <small>{transfer?p.token:'MON'}</small></strong></div><span className="coin mon-coin">{transfer&&p.token==='USDC'?'$':'M'}</span></div>
      <div className="swap-arrow"><ArrowDown size={16}/></div>
      {transfer?<div className="recipient-review"><span>Recipient {p.recipient_name?`· ${p.recipient_name}`:''}</span><code>{p.recipient}</code><label><input type="checkbox" checked={recipientChecked} onChange={e=>setRecipientChecked(e.target.checked)} disabled={busy}/>I checked this full address with the recipient.</label></div>:<div className="swap-amount output"><div><span>You {p.mode==='mock'?'would receive':'receive approximately'}</span><strong>{p.estimated_usdc} <small>{p.mode==='mock'?'demo USDC':'USDC'}</small></strong></div><span className="coin usdc-coin">$</span></div>}
      <dl className="preview-details"><div><dt>Network</dt><dd>Monad Testnet</dd></div>{!transfer&&<><div><dt>Minimum received</dt><dd>{p.minimum_usdc} {p.mode==='mock'?'demo USDC':'USDC'}</dd></div><div><dt>Slippage limit</dt><dd>{p.slippage_bps/100}%</dd></div></>}
        <div><dt>Live gas price</dt><dd>{p.gas_price_gwei} gwei</dd></div>
        <div><dt>Wallet fee cap</dt><dd>{p.mode==='mock'?'No transaction fee':estimate?`${estimate.maximumFeeMon} MON${estimate.sponsored?' · sponsored':''}`:estimating?'Estimating full wallet operation…':'Fee unavailable · approval disabled'}</dd></div>
        {p.max_gas_price_gwei&&<div><dt>Your gas rule</dt><dd>Below {p.max_gas_price_gwei} gwei</dd></div>}
        {p.min_balance_mon&&<div><dt>Balance condition</dt><dd>More than {p.min_balance_mon} MON · rechecked before sending</dd></div>}
        <div><dt>Preview expires</dt><dd className={seconds<30?'error-text':''}>{seconds>0?`${seconds}s`:'Expired · prepare again'}</dd></div></dl>
      <div className="safety-list"><span><Check size={14}/> Known tokens only</span><span><Check size={14}/> {p.simulation==='mock_only'?'Clearly labelled rehearsal':'RPC call simulation passed'}</span><span><Check size={14}/> {p.max_gas_price_gwei?'Gas rule checked before approval':'Approval is always yours'}</span></div>
      <div className="notice preview-notice">{p.warnings.map(w=><p key={w}>{w}</p>)}</div>
      {error&&<div role="alert" className="error-box">{error}</div>}
      {onRetry&&error&&!busy&&<button className="button secondary wide" onClick={onRetry}>Retry fee estimate</button>}
      {speechControls}<div className="preview-actions"><button className="button secondary" disabled={busy} onClick={onCancel}>Cancel</button>
        <button className="button primary" disabled={busy||!canConfirm||seconds===0||(transfer&&!recipientChecked)} onClick={onConfirm}>{busy?<LoaderCircle size={17} className="spin"/>:<Fingerprint size={17}/>} {estimating?'Checking wallet fee…':busy?'Awaiting approval…':'Confirm with Passkey'}</button></div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
