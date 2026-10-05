'use client';
import {useEffect,useRef,useState} from 'react';
import {Mic,MicOff} from 'lucide-react';
type Recognition={lang:string;interimResults:boolean;continuous:boolean;onresult:((e:{results:{0:{0:{transcript:string}}}})=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;abort:()=>void};
type VoiceWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
export default function VoiceInput({disabled,onText}:{disabled:boolean;onText:(s:string)=>void}){
 const [listening,setListening]=useState(false),[message,setMessage]=useState('');
 const speech=useRef<Recognition|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),disabledRef=useRef(disabled);
 disabledRef.current=disabled;
 function clearTimer(){if(timer.current)clearTimeout(timer.current);timer.current=null;}
 useEffect(()=>()=>{clearTimer();speech.current?.abort();},[]);
 useEffect(()=>{if(disabled)speech.current?.abort();},[disabled]);
 function notice(text:string){setMessage(text);}
 function start(){
  if(listening){speech.current?.abort();clearTimer();setListening(false);setMessage('');return;}
  setMessage('');
  if(!window.isSecureContext){notice('Voice needs HTTPS or localhost. On your phone, open the deployed HTTPS app.');return;}
  const w=window as VoiceWindow,Constructor=w.SpeechRecognition||w.webkitSpeechRecognition;
  if(!Constructor){notice('This browser has no speech recognition. Open in Chrome or Safari, or use the microphone on your phone’s keyboard.');return;}
  const instance=new Constructor();speech.current=instance;instance.lang=navigator.language||'en-US';instance.continuous=false;instance.interimResults=false;
  let captured=false,failed=false;
  instance.onresult=e=>{const text=e.results?.[0]?.[0]?.transcript;if(text&&!disabledRef.current){captured=true;onText(text.slice(0,2000));setMessage('');}};
  instance.onerror=e=>{failed=true;clearTimer();setListening(false);const errors:Record<string,string>={
   'not-allowed':'Microphone access is blocked. Use the site controls beside the address bar → Microphone → Allow, then try again. Also check Windows microphone privacy settings.',
   'service-not-allowed':'Your browser blocked its speech service. Try Chrome, or use keyboard dictation.',
   'audio-capture':'No microphone is available. Connect or enable a microphone in your device settings.',
   'network':'The browser’s speech service could not connect. Check your connection, try Chrome, or use keyboard dictation.',
   'no-speech':'No speech was detected. Click the microphone and speak after Listening appears.'};
   if(e.error!=='aborted')notice(errors[e.error]||'Voice input could not finish. Try again or type your request.');};
  instance.onend=()=>{clearTimer();setListening(false);if(!failed)setMessage('');};
  try{setListening(true);setMessage('');
   timer.current=setTimeout(()=>{failed=true;instance.abort();setListening(false);notice('No speech result received. Check microphone permission or use keyboard dictation.');},20000);instance.start();
  }catch{clearTimer();setListening(false);notice('Voice could not start. Check microphone permission or use keyboard dictation.');}
 }
 return <div className="voice-control"><button type="button" className={`icon-button voice-button ${listening?'listening':''}`} disabled={disabled} onClick={start} aria-label={listening?'Stop listening':'Voice input'} aria-pressed={listening} title="Dictate, review, then send. Browser speech services may process audio online.">{listening?<MicOff size={19}/>:<Mic size={19}/>}</button>{listening&&<span className="voice-listening" role="status">Listening…</span>}{message&&<span className="voice-feedback" role="status">{message}<button type="button" className="text-button" onClick={()=>setMessage('')} aria-label="Dismiss voice help">Dismiss</button></span>}</div>;
}
