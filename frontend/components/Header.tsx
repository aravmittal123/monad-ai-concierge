import {Copy,Fingerprint,LogOut,Menu,Moon,ShieldCheck,Sun} from 'lucide-react';
import {shortAddress} from '@/lib/monad';
export default function Header({address,observer,onLogout,onCopy,onConnect,onMenu,theme,onTheme}:{address?:string;observer:boolean;onLogout:()=>void;onCopy:()=>void;onConnect:()=>void;onMenu:()=>void;theme:'dark'|'light';onTheme:()=>void}) {
  return <header className="header glass"><div className="brand-group"><button className="icon-button mobile-menu" aria-label="Toggle sidebar" onClick={onMenu}><Menu size={21}/></button>
    <a className="brand" href="/" aria-label="Monad Concierge home"><span className="brand-mark">m<span>✦</span></span><span>Monad <span className="brand-muted">Concierge</span></span></a></div>
    <div className="header-actions"><span className="network">Monad Testnet</span>
      <button className="icon-button" onClick={onTheme} aria-label={`Switch to ${theme==='dark'?'light':'dark'} mode`}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button>
      {address?<><button className="account-pill" onClick={onCopy} title="Copy account address"><ShieldCheck size={15}/>{shortAddress(address)}<Copy size={13}/></button>
        <button className="icon-button" onClick={onLogout} aria-label="Disconnect"><LogOut size={17}/></button></>:
        <button className="button primary connect-button" onClick={onConnect}><Fingerprint size={17}/> Connect Wallet</button>}
      {observer&&<><span className="observer-tag">Read only</span><button className="button secondary observer-connect" onClick={onConnect}>Connect</button></>}
    </div></header>;
}
