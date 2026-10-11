'use client';
import {useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {X,MessageCircleQuestion} from 'lucide-react';
const groups={
 'Read live data':['Check my balance','How much MON do I have?','Check my USDC balance','What’s the gas price?'],
 'Pay a saved contact':['Send 0.001 MON to Father','Please transfer 1 USDC to Daughter','Can you send Father 0.01 MON?','Send 0.001 MON to Father only if gas is below 150 gwei'],
 'Review a swap':['Swap 1 MON to USDC','Swap 1 MON to USDC only if gas is below 150 gwei','Check my balance, and if I have more than 5 MON, swap 2 to USDC'],
 'Understand your wallet':['What can you do?','Explain wallet fees','What is a passkey?','Why is my transaction pending?','How do I save a contact?','How does sponsorship work?','What is the trust score?','Are swaps real?','How do I install this on my phone?','Is this real money?','Is this safe?'],
};
export default function PromptExamples({onSelect,disabled}:{onSelect:(prompt:string)=>void;disabled:boolean}){
 const [open,setOpen]=useState(false);
 return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger asChild><button className="text-button" disabled={disabled}><MessageCircleQuestion size={14}/> What can I ask?</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="preview-dialog"><div className="modal-heading"><Dialog.Title>Explore the Concierge</Dialog.Title><Dialog.Close className="icon-button" aria-label="Close examples"><X size={18}/></Dialog.Close></div><Dialog.Description>Pick an example, edit it, then send. Transfers need a connected, funded wallet and your approval. Check the preview: live swaps exchange test tokens; Demo Mode never moves funds.</Dialog.Description>{Object.entries(groups).map(([title,prompts])=><section className="prompt-group" key={title}><h3>{title}</h3>{prompts.map(prompt=><button className="example-prompt" key={prompt} onClick={()=>{onSelect(prompt);setOpen(false);}}>{prompt}</button>)}</section>)}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
