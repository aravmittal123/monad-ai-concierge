'use client';
import {useEffect,useState} from 'react';
import {api,friendlyError} from '@/lib/api';
export default function TokenBalance({address,revision}:{address:string;revision:number}){
 const [balance,setBalance]=useState<string|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;setBalance(null);setError('');api<{usdc:string}>('tokens',{prompt:'Read token balance',wallet_address:address})
  .then(r=>{if(active)setBalance(r.usdc);}).catch(e=>{if(active)setError(friendlyError(e));});return()=>{active=false;};},[address,revision,refresh]);
 return <div className="token-balance"><p>Testnet USDC <strong>{balance??(error?'Unavailable':'…')}</strong></p>
  <button className="text-button" onClick={()=>setRefresh(n=>n+1)}>Refresh USDC</button>
  {error&&<small role="status">{error}</small>}
  <a className="faucet-link" href={`https://testnet.monadscan.com/address/${address}#tokentxns`} target="_blank" rel="noopener noreferrer">Token transfers ↗</a>
 </div>;
}
