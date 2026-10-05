'use client';
import {useEffect,useRef,useState} from 'react';

// Presentation-only reveal: the validated response is already complete.
// Never progressively construct a transaction or its approval fields.
export default function ReplyText({text,animate=true}:{text:string;animate?:boolean}){
 const [visible,setVisible]=useState(animate?'':text),ref=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  if(!animate||matchMedia('(prefers-reduced-motion: reduce)').matches){setVisible(text);return;}
  let frame=0;const started=performance.now(),duration=Math.min(4500,Math.max(500,text.length*10));
  const letters=Array.from(text);
  function reveal(now:number){
   const progress=Math.min(1,(now-started)/duration);
   const scroller=ref.current?.closest('.chat-scroll');
   const follow=scroller?scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<140:false;
   setVisible(letters.slice(0,Math.ceil(letters.length*progress)).join(''));
   if(follow&&scroller)scroller.scrollTop=scroller.scrollHeight;
   if(progress<1)frame=requestAnimationFrame(reveal);
  }
  setVisible('');frame=requestAnimationFrame(reveal);return()=>cancelAnimationFrame(frame);
 },[text,animate]);
 const revealing=visible!==text;
 return <span ref={ref} className={revealing?'reply-revealing':''} data-revealing={revealing}>
  <span aria-hidden="true">{visible}</span><span className="sr-only">{text}</span>
 </span>;
}
