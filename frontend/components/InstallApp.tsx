'use client';
import {useEffect,useState} from 'react';
import {Download} from 'lucide-react';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function InstallApp({onNotice}:{onNotice:(message:string)=>void}){
 const [install,setInstall]=useState<InstallEvent|null>(null);
 useEffect(()=>{if('serviceWorker' in navigator&&process.env.NODE_ENV==='production')navigator.serviceWorker.register('/sw.js').catch(()=>{});
 const ready=(event:Event)=>{event.preventDefault();setInstall(event as InstallEvent);};const done=()=>setInstall(null);
 window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done);return()=>{window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done);};},[]);
 return <button className="icon-button" title="Install app" aria-label="Install app" onClick={async()=>{if(install){await install.prompt();await install.userChoice;setInstall(null);}else onNotice('Use your browser menu → Install app / Add to Home Screen. On iPhone, use Safari’s Share menu.');}}><Download size={16}/></button>;
}
