'use client';
import {useEffect,useState} from 'react';
import {ShieldCheck} from 'lucide-react';
import {api} from '@/lib/api';
export default function TrustBadge({address,registry,revision=0}:{address:string;registry?:string|null;revision?:number}){
 const [score,setScore]=useState<number|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let cancelled=false;setScore(null);setFailed(false);if(registry)api<{score:number|null}>('activity',{prompt:'Read activity',wallet_address:address}).then(d=>{if(!cancelled)setScore(d.score);}).catch(()=>{if(!cancelled)setFailed(true);});return()=>{cancelled=true;};},[address,registry,revision]);
 return <div className="trust-badge" title="Counts real MON payments through the configured contract, capped at 100. Activity does not prove identity, safety or creditworthiness. This is not ERC-8004."><ShieldCheck size={13}/>{!registry?'On-chain score not configured':failed?'On-chain score unavailable':score===null?'Reading on-chain activity…':`On-chain activity · ${score}/100`}</div>;
}
