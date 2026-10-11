'use client';
import {useId} from 'react';
import {Volume2,VolumeX,Square,RotateCcw} from 'lucide-react';
import type {useSpokenReplies} from '@/lib/use-spoken-replies';
export default function SpokenReplies({audio}:{audio:ReturnType<typeof useSpokenReplies>}){
 const voiceId=useId();
 return <div className="spoken-controls">
  <button type="button" className="icon-button" aria-label="Spoken replies" aria-pressed={audio.enabled} disabled={!audio.supported} onClick={audio.toggle} title={audio.supported?'Turn spoken replies on or off':'Speech output is unavailable in this browser'}>{audio.enabled?<Volume2 size={17}/>:<VolumeX size={17}/>}</button>
  {audio.enabled&&<><button type="button" className="icon-button" aria-label={audio.speaking?'Stop speaking':'Replay spoken reply'} onClick={audio.speaking?audio.stop:audio.replay}>{audio.speaking?<Square size={14}/>:<RotateCcw size={14}/>}</button>
   <label className="sr-only" htmlFor={voiceId}>Output voice</label><select id={voiceId} aria-label="Output voice" title="Choose a browser voice. Voice selection changes pronunciation; it does not translate replies. Some voices use an online speech service." value={audio.voiceURI} onChange={e=>audio.chooseVoice(e.target.value)}><option value="">Automatic English voice</option>{audio.voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang}){v.localService?' · device':''}</option>)}</select></>}
  {audio.error&&<small role="status">{audio.error}</small>}
 </div>;
}
