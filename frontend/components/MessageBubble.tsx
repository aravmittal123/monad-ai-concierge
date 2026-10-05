import {ArrowUpRight,Bot,CheckCircle2,ShieldCheck,UserRound} from 'lucide-react';
import type {ChainData,TransactionResult} from '@/lib/types';
import {decimalLabel} from '@/lib/monad';
import ReplyText from './ReplyText';
export type Message = {id:string;role:'user'|'assistant';text:string;data?:ChainData;error?:boolean;result?:TransactionResult;pendingHash?:string;intentSource?:'command'|'gemini'|'nvidia'};
export default function MessageBubble({message}:{message:Message}) {
  const user=message.role==='user';
  return <div className={`message ${user?'message-user':'message-assistant'}`}>
    <div className={`avatar ${user?'user-avatar':''}`}>{user?<UserRound size={16}/>:<Bot size={19}/>}</div>
    <div className="message-content"><div className="message-author">{user?'You':'Monad Concierge'}{!user&&<span>✦</span>}</div>
      <div className={`message-body ${message.error?'error-text':''}`}><ReplyText text={message.text} animate={!user&&!message.error}/></div>
      {message.intentSource&&<div className="intent-source">{message.intentSource==='command'?'Direct command · no AI call':message.intentSource==='nvidia'?'Intent interpreted by NVIDIA Nemotron':'Intent interpreted by Gemini'}</div>}
      {message.data&&<div className="data-strip"><span><span className="data-label">Balance</span><strong>{decimalLabel(message.data.balance_mon)} <small>MON</small></strong></span>
        <span><span className="data-label">Gas price</span><strong>{message.data.gas_price_gwei} <small>gwei</small></strong></span>
        <span className="verified-data"><ShieldCheck size={13}/> RPC verified · #{message.data.block_number}</span></div>}
      {message.result?.kind==='rehearsal'&&<div className="simulation-receipt"><CheckCircle2 size={14}/><span>Simulation · no transaction sent</span></div>}
      {message.result?.kind==='transaction'&&<div className="result-card"><CheckCircle2 size={18}/><div><strong>Transaction successful</strong><p>Confirmed on Monad Testnet.</p>
        <a href={`https://testnet.monadscan.com/tx/${message.result.hash}`} target="_blank" rel="noopener noreferrer">View transaction <ArrowUpRight size={13}/></a><code>{message.result.hash}</code></div></div>}
      {message.pendingHash&&<div className="notice">Operation submitted. Keep this hash to check status:<code>{message.pendingHash}</code></div>}
    </div></div>;
}
