'use client';
import {useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {Trash2,Users,X} from 'lucide-react';
import {validContact} from '@/lib/local-data';
import type {Contact} from '@/lib/types';
export default function Contacts({contacts,onChange,onSend,disabled}:{contacts:Contact[];onChange:(c:Contact[])=>void;onSend:(c:Contact)=>void;disabled:boolean}){
  const [open,setOpen]=useState(false),[name,setName]=useState(''),[address,setAddress]=useState(''),[error,setError]=useState('');
  function save(e:React.FormEvent){e.preventDefault();try{const next=validContact(name,address);if(contacts.some(c=>c.name.toLowerCase()===next.name.toLowerCase()))throw new Error('That name already exists. Remove the old contact before replacing its address.');if(contacts.length>=30)throw new Error('You can save up to 30 contacts.');onChange([...contacts,next]);setName('');setAddress('');setError('');}catch(e){setError(e instanceof Error?e.message:'Contact could not be saved.');}}
  return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger asChild><button className="text-button contact-trigger" disabled={disabled}><Users size={14}/> Saved contacts <span>{contacts.length}</span></button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="preview-dialog contacts-dialog"><div className="modal-heading"><Dialog.Title>People you pay</Dialog.Title><Dialog.Close className="icon-button" aria-label="Close contacts"><X size={18}/></Dialog.Close></div>
    <Dialog.Description>Saved on this browser. Confirm the full address with your recipient before sending.</Dialog.Description>
    <div className="contact-list">{contacts.length===0&&<p>No contacts yet. Add Father, Daughter, or another name below.</p>}{contacts.map(c=><div className="contact-row" key={c.name}><button onClick={()=>{onSend(c);setOpen(false);}}><strong>{c.name}</strong><code>{c.address}</code></button><button className="icon-button" aria-label={`Delete ${c.name}`} onClick={()=>onChange(contacts.filter(item=>item.name!==c.name))}><Trash2 size={15}/></button></div>)}</div>
    <form onSubmit={save}><label className="field-label" htmlFor="contact-name">Contact name</label><input className="text-field" id="contact-name" placeholder="Father" value={name} onChange={e=>setName(e.target.value)} maxLength={32}/><label className="field-label" htmlFor="contact-address">Recipient address</label><input className="text-field" id="contact-address" placeholder="0x…" value={address} onChange={e=>setAddress(e.target.value)}/>{error&&<p role="alert" className="error-text">{error}</p>}<button className="button primary wide">Save contact</button></form>
    </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
