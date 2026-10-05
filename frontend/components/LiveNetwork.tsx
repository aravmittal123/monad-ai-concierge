'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Flame,RefreshCw,Radio} from 'lucide-react';
import {api} from '@/lib/api';
import type {GasData} from '@/lib/types';
export default function LiveNetwork({onStatus}:{onStatus:(live:boolean)=>void}) {
  const [data,setData]=useState<GasData|null>(null),[error,setError]=useState(false),[loading,setLoading]=useState(true);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null),failures=useRef(0),active=useRef(true),inFlight=useRef(false),status=useRef(onStatus);
  useEffect(()=>{status.current=onStatus;},[onStatus]);
  const refresh=useCallback(async function poll(){
    if(!active.current||inFlight.current)return;
    if(timer.current)clearTimeout(timer.current);
    if(document.hidden){timer.current=setTimeout(poll,5000);return;}
    inFlight.current=true;setLoading(true);
    try{const result=await api<GasData>('gas');if(!active.current)return;setData(result);setError(false);failures.current=0;status.current(true);}
    catch{if(!active.current)return;setError(true);failures.current++;status.current(false);}
    finally{inFlight.current=false;if(active.current){setLoading(false);timer.current=setTimeout(poll,Math.min(30000,5000*2**failures.current));}}
  },[]);
  useEffect(()=>{active.current=true;void refresh();const visible=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',visible);
    return()=>{active.current=false;if(timer.current)clearTimeout(timer.current);document.removeEventListener('visibilitychange',visible);};},[refresh]);
  const level=data?(BigInt(data.gas_price_wei)<1000000000n?'low':BigInt(data.gas_price_wei)<=5000000000n?'medium':'high'):'unknown';
  return <section className={`network-widget glass ${error?'stale':''}`} aria-label="Live network">
    <div className="section-heading"><span><Radio size={14}/> Live network</span><span className={error?'amber-dot':'green-dot'}/></div>
    <div className={`gas-reading gas-${level}`}><Flame size={20}/><strong>{data?data.gas_price_gwei:'—'}</strong><span>gwei</span></div>
    <div className="network-detail"><span>Block {data?`#${data.block_number.toLocaleString()}`:'—'}</span><button className="icon-button" aria-label="Refresh network" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={13} className={loading?'spin':''}/></button></div>
    <small>{error?'Connection lost · retrying. Last reading is stale.':data?`Updated ${new Date(data.observed_at*1000).toLocaleTimeString()} · every 5s`:'Connecting to Monad…'}</small>
    <small className="gas-legend">Low &lt;1 · moderate 1–5 · high &gt;5 gwei</small>
  </section>;
}
