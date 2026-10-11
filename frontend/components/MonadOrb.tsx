'use client';
import {useRef} from 'react';
/** CSS geometry keeps the decorative model lightweight and works without WebGL. */
export default function MonadOrb(){
 const ref=useRef<HTMLDivElement>(null);
 return <div className="orb-stage" aria-hidden="true" onPointerMove={e=>{
   if(e.pointerType!=='mouse'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   const bounds=e.currentTarget.getBoundingClientRect();
   ref.current?.style.setProperty('--tilt-x',`${(e.clientY-bounds.top-bounds.height/2)/8}deg`);
   ref.current?.style.setProperty('--tilt-y',`${(e.clientX-bounds.left-bounds.width/2)/8}deg`);
 }} onPointerLeave={()=>{ref.current?.style.setProperty('--tilt-x','0deg');ref.current?.style.setProperty('--tilt-y','0deg');}}>
  <div className="orb-shadow"/><div className="orb-tilt" ref={ref}><div className="orb-core"><span>m<span>✦</span></span></div>
  <div className="orb-orbit orbit-one"><i/></div><div className="orb-orbit orbit-two"><i/></div><div className="orb-orbit orbit-three"/>
  </div>
 </div>;
}
