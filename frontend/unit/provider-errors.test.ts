import {expect,test} from 'vitest';
import {decodeErrorResult,encodeErrorResult} from 'viem';
import {rpcError} from '../lib/provider-errors';
const abi=[{type:'error',name:'SenderAddressResult',inputs:[{name:'sender',type:'address'}]}] as const;
test('EntryPoint revert still decodes the counterfactual smart account through the gateway',()=>{
 const sender='0x1111111111111111111111111111111111111111';
 const data=encodeErrorResult({abi,errorName:'SenderAddressResult',args:[sender]});
 const safe=rpcError({code:3,message:'execution reverted at https://provider.invalid/secret',data});
 expect(decodeErrorResult({abi,data:safe.data as `0x${string}`})).toMatchObject({errorName:'SenderAddressResult',args:[sender]});
 expect(safe.message).not.toContain('secret');
});
test('nested RPC revert data is normalized without diagnostic objects',()=>{
 expect(rpcError({code:3,data:{data:'0x1234',apiKey:'secret'}}).data).toBe('0x1234');
 expect(JSON.stringify(rpcError({code:3,data:{data:'0x1234',apiKey:'secret'}}))).not.toContain('secret');
});
test.each(['https://provider.invalid/secret','0x123','0xzz',{apiKey:'secret'},'0x'+'ab'.repeat(20000)])('unsafe or oversized diagnostic data is omitted: %#',data=>{
 expect(rpcError({code:3,message:'secret',data})).not.toHaveProperty('data');
});
