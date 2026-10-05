import {afterEach,expect,test,vi} from 'vitest';
import {rpcFetch} from '../lib/rpc-fetch';
import {rpcError} from '../lib/provider-errors';
import {friendlyError} from '../lib/api';
afterEach(()=>vi.unstubAllGlobals());
test('provider domain failure is actionable without leaking upstream data',()=>{
 const safe=rpcError('Access denied: Neither IP nor domain is on the allowlist. https://secret.invalid/key');
 expect(safe.message).toContain('domain allowlist');expect(safe.message).not.toContain('secret');
 expect(friendlyError(new Error('SDK wrapper: '+safe.message))).toBe(safe.message);
});
test('transient wallet read retries once with the validated website origin',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('{}',{status:503})).mockResolvedValueOnce(new Response('{"result":"0x279f"}'));
 vi.stubGlobal('fetch',fetcher);const result=await rpcFetch('https://provider.invalid',{method:'eth_chainId'},'http://localhost:3000');
 expect(result.status).toBe(200);expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[0][1].headers.Origin).toBe('http://localhost:3000');
});
test('allowlist denial is not retried',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response('{}',{status:403}));vi.stubGlobal('fetch',fetcher);await rpcFetch('https://provider.invalid',{method:'eth_chainId'},'https://app.invalid');expect(fetcher).toHaveBeenCalledOnce();});
test('ambiguous send timeout is never automatically resubmitted',async()=>{const fetcher=vi.fn().mockRejectedValue(new Error('timeout'));vi.stubGlobal('fetch',fetcher);await expect(rpcFetch('https://provider.invalid',{method:'eth_sendUserOperation'},'https://app.invalid')).rejects.toThrow();expect(fetcher).toHaveBeenCalledOnce();});
