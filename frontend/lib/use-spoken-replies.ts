'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Preview} from './types';

export function approvalSpeech(p:Preview,readOnly:boolean,fee?:string,sponsored=false):string{
 if(readOnly)return 'This account is read only. You can review this preview, but must connect your passkey wallet to approve.';
 if(p.mode==='mock')return `This is a simulation of swapping ${p.amount_mon} MON to USDC. No funds will move. Review the preview, then choose Confirm with Passkey if you want to approve the simulation.`;
 const action=p.action==='transfer'
  ?`You are sending ${p.amount} ${p.token} to ${p.recipient_name||'the recipient'}. Check the full recipient address on screen.`
  :`You are swapping ${p.amount_mon} MON for approximately ${p.estimated_usdc} USDC. The minimum received is ${p.minimum_usdc} USDC.`;
 return `${action} This moves real testnet tokens. ${fee?`The maximum wallet fee is ${fee} MON${sponsored?', sponsored by the paymaster':''}.`:''} Review every detail on screen, then choose Confirm with Passkey to authorize. Speaking does not authorize a payment.`;
}

export function useSpokenReplies(){
 const [supported,setSupported]=useState(false),[enabled,setEnabled]=useState(false),[speaking,setSpeaking]=useState(false);
 const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([]),[voiceURI,setVoiceURI]=useState(''),[error,setError]=useState('');
 const enabledRef=useRef(false),voiceRef=useRef(''),utterance=useRef<SpeechSynthesisUtterance|null>(null),last=useRef('');
 const stop=useCallback(()=>{if(typeof window!=='undefined'&&'speechSynthesis' in window){utterance.current=null;window.speechSynthesis.cancel();}setSpeaking(false);},[]);
 useEffect(()=>{
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window))return;
  setSupported(true);
  const load=()=>setVoices(window.speechSynthesis.getVoices());load();
  window.speechSynthesis.addEventListener('voiceschanged',load);window.addEventListener('pagehide',stop);
  try{const saved=localStorage.getItem('concierge.outputVoice');voiceRef.current=saved||'';setVoiceURI(saved||'');}catch{}
  return()=>{window.speechSynthesis.removeEventListener('voiceschanged',load);window.removeEventListener('pagehide',stop);window.speechSynthesis.cancel();};
 },[stop]);
 const speak=useCallback((text:string)=>{
  last.current=text;
  if(!enabledRef.current||!('speechSynthesis' in window))return;
  stop();setError('');
  const u=new SpeechSynthesisUtterance(text.slice(0,3000));
  const available=window.speechSynthesis.getVoices();
  // Prefer English for the app's English responses; a voice choice changes pronunciation, not translation.
  const selected=available.find(v=>v.voiceURI===voiceRef.current)||available.find(v=>v.lang.startsWith('en')&&v.localService)||available.find(v=>v.lang.startsWith('en'));
  if(selected){u.voice=selected;u.lang=selected.lang;}else u.lang='en-US';
  u.rate=1;utterance.current=u;
  u.onstart=()=>{if(utterance.current===u)setSpeaking(true);};
  u.onend=()=>{if(utterance.current===u){utterance.current=null;setSpeaking(false);}};
  u.onerror=e=>{if(utterance.current!==u)return;utterance.current=null;setSpeaking(false);if(!['canceled','interrupted'].includes(e.error))setError('Audio could not play. Try Replay or choose another voice.');};
  try{window.speechSynthesis.speak(u);}catch{utterance.current=null;setSpeaking(false);setError('Audio could not play. Try Replay or choose another voice.');}
 },[stop]);
 const toggle=useCallback(()=>{const next=!enabledRef.current;enabledRef.current=next;setEnabled(next);if(next)speak(last.current||'Spoken replies enabled. I will read responses and ask you to review actions before passkey approval.');else stop();},[speak,stop]);
 const chooseVoice=useCallback((uri:string)=>{stop();voiceRef.current=uri;setVoiceURI(uri);try{localStorage.setItem('concierge.outputVoice',uri);}catch{}},[stop]);
 const clear=useCallback(()=>{last.current='';stop();},[stop]);
 const replay=useCallback(()=>{if(last.current)speak(last.current);},[speak]);
 return {supported,enabled,speaking,voices,voiceURI,error,stop,clear,speak,toggle,chooseVoice,replay};
}
