import {describe,it,expect} from 'vitest';
import {approvalSpeech} from '../lib/use-spoken-replies';
import type {Preview} from '../lib/types';
const p={mode:'transfer',action:'transfer',amount:'1',token:'MON',recipient_name:'Father',amount_mon:'1',estimated_usdc:'4',minimum_usdc:'3.98'} as Preview;
describe('spoken approval prompts',()=>{
 it('requires screen review and passkey; includes quoted fee',()=>{const text=approvalSpeech(p,false,'0.35');expect(text).toContain('1 MON to Father');expect(text).toContain('0.35 MON');expect(text).toContain('Check the full recipient address on screen');expect(text).toContain('Speaking does not authorize a payment');});
 it('never solicits authorization from read only accounts',()=>{expect(approvalSpeech(p,true)).toContain('read only');expect(approvalSpeech(p,true)).not.toContain('choose Confirm');});
 it('does not describe demo approval as moving funds',()=>{const text=approvalSpeech({...p,mode:'mock',action:'swap'},false);expect(text).toContain('No funds will move');expect(text).toContain('approve the simulation');});
 it('reads minimum USDC for a real swap',()=>{const text=approvalSpeech({...p,mode:'puddleswap_v2',action:'swap'},false,'0.3',true);expect(text).toContain('minimum received is 3.98 USDC');expect(text).toContain('sponsored by the paymaster');});
});
