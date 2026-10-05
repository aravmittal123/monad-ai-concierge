import {getAddress,isAddress,zeroAddress} from 'viem';
import type {Activity,Contact} from './types';
export function validContact(name:string,address:string):Contact {
  name=name.trim();address=address.trim();
  if(!/^[A-Za-z][A-Za-z0-9 '\-]{0,31}$/.test(name))throw new Error('Use a name of 1–32 letters, numbers, spaces, hyphens or apostrophes.');
  if(!isAddress(address,{strict:true})||address.toLowerCase()===zeroAddress)throw new Error('Enter a full wallet address with a valid checksum. The zero address is not allowed.');
  return {name,address:getAddress(address)};
}
export function loadContacts():Contact[] {
  try{const data=JSON.parse(localStorage.getItem('concierge.contacts.v1')||'[]');
    if(!Array.isArray(data))return [];const seen=new Set<string>();
    return data.slice(0,30).flatMap(c=>{try{const value=validContact(c.name,c.address);if(seen.has(value.name.toLowerCase()))return [];seen.add(value.name.toLowerCase());return [value];}catch{return [];}});
  }catch{return [];}
}
export function loadActivity(account:string):Activity[] {
  try{const data=JSON.parse(localStorage.getItem(`concierge.activity.v1.${account.toLowerCase()}`)||'[]');
    if(!Array.isArray(data))return [];
    return data.filter(a=>a&&a.account?.toLowerCase()===account.toLowerCase()&&typeof a.id==='string'&&typeof a.title==='string'&&a.title.length<200&&Number.isFinite(a.time)&&['confirmed','demo-approved','pending','failed','cancelled'].includes(a.status)&&(!a.hash||/^0x[0-9a-fA-F]{64}$/.test(a.hash))&&(!a.userOpHash||/^0x[0-9a-fA-F]{64}$/.test(a.userOpHash))).slice(0,50);
  }catch{return [];}
}
