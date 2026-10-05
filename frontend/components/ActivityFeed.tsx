import {ArrowUpRight,CheckCircle2,Clock,FlaskConical,History,XCircle} from 'lucide-react';
import type {Activity} from '@/lib/types';
export default function ActivityFeed({items,onCheck}:{items:Activity[];onCheck:(a:Activity)=>void}){
  return <section className="activity-feed"><div className="section-heading"><span><History size={14}/> Recent activity</span><small>{items.length}</small></div>
  {!items.length&&<p className="empty-activity">Approved actions will appear here.</p>}
  <div className="activity-list">{items.slice(0,8).map(a=><article className={`activity-item activity-${a.status}`} key={a.id}>
    <span className="activity-icon">{a.status==='confirmed'?<CheckCircle2 size={15}/>:a.status==='demo-approved'?<FlaskConical size={15}/>:a.status==='pending'?<Clock size={15}/>:<XCircle size={15}/>}</span>
    <div><strong>{a.title}</strong><small>{a.status==='demo-approved'?'Demo approved · no funds moved':a.status} · {new Date(a.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small>
    {a.hash&&<a href={`https://testnet.monadscan.com/tx/${a.hash}`} target="_blank" rel="noopener noreferrer">Receipt <ArrowUpRight size={11}/></a>}
    {a.status==='pending'&&<button className="text-button" onClick={()=>onCheck(a)}>Check receipt</button>}</div></article>)}</div>
  <small className="storage-note">This browser’s activity only. Not a complete wallet history.</small></section>;
}
