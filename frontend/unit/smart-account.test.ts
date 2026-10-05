import {beforeEach,expect,test,vi} from 'vitest';
import type {Prepared,Preview} from '../lib/types';
const {gateway}=vi.hoisted(()=>({gateway:vi.fn()}));
vi.mock('../lib/api',()=>({api:gateway,ApiError:class extends Error {code:string;constructor(code:string,message:string){super(message);this.code=code;}}}));
vi.mock('../lib/monad',()=>({monad:{id:10143},getPublicClient:vi.fn()}));
vi.mock('@zerodev/sdk',()=>({createKernelAccount:vi.fn(),createKernelAccountClient:vi.fn(),createZeroDevPaymasterClient:vi.fn(),getUserOperationGasPrice:vi.fn()}));
vi.mock('@zerodev/sdk/constants',()=>({getEntryPoint:vi.fn(),KERNEL_V3_3:'0.3.3'}));
vi.mock('@zerodev/passkey-validator',()=>({toPasskeyValidator:vi.fn(),toWebAuthnKey:vi.fn(),WebAuthnMode:{},PasskeyValidatorContractVersion:{}}));
import {confirm,estimate,type WalletSession,type WalletEstimate} from '../lib/smart-account';
const address='0x1111111111111111111111111111111111111111';
function prepared(real=false):Prepared{return {preview_token:'signed-token',preview:{preview_id:'id',wallet_address:address,chain_id:10143,
 mode:real?'uniswap_v3':'mock',amount_mon:'1',estimated_usdc:'0.1',minimum_usdc:'0.0995',slippage_bps:50,
 gas_price_gwei:'102',estimated_call_gas_mon:null,max_gas_price_gwei:null,expires_at:Math.floor(Date.now()/1000)+180,
 simulation:real?'rpc_call_passed':'mock_only',transaction:real?{to:address,value:'1000000000000000000',data:'0xab'}:null,warnings:[],requires_confirmation:true}};}
function wallet(){return {address,account:{encodeCalls:vi.fn().mockResolvedValue('0xcafe'),signUserOperation:vi.fn().mockResolvedValue('0xsignature')},
 client:{signMessage:vi.fn().mockResolvedValue('0xsignature'),prepareUserOperation:vi.fn().mockResolvedValue({callData:'0xcafe',callGasLimit:100000n,verificationGasLimit:200000n,preVerificationGas:50000n,maxFeePerGas:102000000000n}),sendUserOperation:vi.fn().mockResolvedValue('0xoperation'),waitForUserOperationReceipt:vi.fn().mockResolvedValue({success:true,receipt:{status:'success',transactionHash:'0xtransaction'}})},
 publicClient:{getChainId:vi.fn().mockResolvedValue(10143),verifyMessage:vi.fn().mockResolvedValue(true),getBalance:vi.fn().mockResolvedValue(2000000000000000000n)}};}
type TestWallet=ReturnType<typeof wallet>;
const session=(value:TestWallet)=>value as unknown as WalletSession;
function validate(p:Prepared){gateway.mockResolvedValue({preview:p.preview,approval_message:'DEMO APPROVAL ONLY — NO FUNDS MOVE'});}
const operation:WalletEstimate={operation:{callData:'0xcafe'} as WalletEstimate['operation'],maximumFeeMon:'0.0357',sponsored:false};
beforeEach(()=>{vi.clearAllMocks();});
test('mock estimation never calls the bundler or requests a signature',async()=>{const w=wallet();expect(await estimate(session(w),prepared().preview)).toBeNull();expect(w.client.prepareUserOperation).not.toHaveBeenCalled();expect(w.client.signMessage).not.toHaveBeenCalled();});
test('mock confirmation verifies approval and returns no transaction hash',async()=>{const w=wallet(),p=prepared();validate(p);expect(await confirm(session(w),p,null,vi.fn())).toEqual({kind:'rehearsal',approvalId:'id'});expect(w.publicClient.verifyMessage).toHaveBeenCalled();expect(w.client.sendUserOperation).not.toHaveBeenCalled();});
test('JSON property order does not cause false preview changes',async()=>{const w=wallet(),p=prepared();const reordered=Object.fromEntries(Object.entries(p.preview).reverse()) as Preview;gateway.mockResolvedValue({preview:reordered,approval_message:'demo'});expect((await confirm(session(w),p,null,vi.fn())).kind).toBe('rehearsal');});
test('account mismatch fails before signing',async()=>{const w=wallet(),p=prepared();p.preview.wallet_address='0x2222222222222222222222222222222222222222';await expect(confirm(session(w),p,null,vi.fn())).rejects.toMatchObject({code:'account_mismatch'});expect(w.client.signMessage).not.toHaveBeenCalled();});
test('tampered preview fails before signing',async()=>{const w=wallet(),p=prepared();gateway.mockResolvedValue({preview:{...p.preview,amount_mon:'9'},approval_message:'demo'});await expect(confirm(session(w),p,null,vi.fn())).rejects.toMatchObject({code:'preview_changed'});expect(w.client.signMessage).not.toHaveBeenCalled();});
test('wrong chain fails before signing',async()=>{const w=wallet(),p=prepared();validate(p);w.publicClient.getChainId.mockResolvedValue(143);await expect(confirm(session(w),p,null,vi.fn())).rejects.toMatchObject({code:'wrong_chain'});expect(w.client.signMessage).not.toHaveBeenCalled();});
test('passkey cancellation cannot submit anything',async()=>{const w=wallet(),p=prepared();validate(p);w.client.signMessage.mockRejectedValue(new DOMException('Cancelled','NotAllowedError'));await expect(confirm(session(w),p,null,vi.fn())).rejects.toThrow('Cancelled');expect(w.client.sendUserOperation).not.toHaveBeenCalled();});
test('invalid passkey signature cannot report approval',async()=>{const w=wallet(),p=prepared();validate(p);w.publicClient.verifyMessage.mockResolvedValue(false);await expect(confirm(session(w),p,null,vi.fn())).rejects.toMatchObject({code:'signature_invalid'});});
test('expiry during approval cannot report approval',async()=>{const w=wallet(),p=prepared();validate(p);w.client.signMessage.mockImplementation(async()=>{p.preview.expires_at=1;return '0xsignature';});await expect(confirm(session(w),p,null,vi.fn())).rejects.toMatchObject({code:'preview_expired'});});
test('full wallet estimate includes verification and deployment gas',async()=>{const w=wallet();expect((await estimate(session(w),prepared(true).preview))?.maximumFeeMon).toBe('0.0357');expect(w.account.signUserOperation).not.toHaveBeenCalled();});
test('bundler gas cap above condition prevents passkey signing',async()=>{const w=wallet(),p=prepared(true);p.preview.max_gas_price_gwei='1';await expect(estimate(session(w),p.preview)).rejects.toMatchObject({code:'gas_limit_exceeded'});expect(w.account.signUserOperation).not.toHaveBeenCalled();});
test('balance covers full wallet fee in addition to swap value',async()=>{const w=wallet();w.publicClient.getBalance.mockResolvedValue(1000000000000000000n);await expect(estimate(session(w),prepared(true).preview)).rejects.toMatchObject({code:'insufficient_balance'});});
test('changed calldata prevents signing',async()=>{const w=wallet(),p=prepared(true);validate(p);w.account.encodeCalls.mockResolvedValue('0xchanged');await expect(confirm(session(w),p,operation,vi.fn())).rejects.toMatchObject({code:'call_changed'});expect(w.account.signUserOperation).not.toHaveBeenCalled();});
test('expired backend policy after signing prevents submission',async()=>{const w=wallet(),p=prepared(true);gateway.mockResolvedValueOnce({preview:p.preview}).mockRejectedValueOnce(new Error('expired'));await expect(confirm(session(w),p,operation,vi.fn())).rejects.toThrow('expired');expect(w.account.signUserOperation).toHaveBeenCalledTimes(1);expect(w.client.sendUserOperation).not.toHaveBeenCalled();});
test('pending receipt preserves operation hash without reporting success',async()=>{const w=wallet(),p=prepared(true),submitted=vi.fn();validate(p);w.client.waitForUserOperationReceipt.mockRejectedValue(new Error('timeout'));await expect(confirm(session(w),p,operation,submitted)).rejects.toMatchObject({code:'receipt_pending'});expect(submitted).toHaveBeenCalledWith('0xoperation');});
test('mined revert cannot report transaction success',async()=>{const w=wallet(),p=prepared(true);validate(p);w.client.waitForUserOperationReceipt.mockResolvedValue({success:false,receipt:{status:'reverted',transactionHash:'0xtransaction'}});await expect(confirm(session(w),p,operation,vi.fn())).rejects.toMatchObject({code:'transaction_reverted'});});
test('successful receipt returns actual receipt hash',async()=>{const w=wallet(),p=prepared(true);validate(p);expect(await confirm(session(w),p,operation,vi.fn())).toEqual({kind:'transaction',hash:'0xtransaction',userOpHash:'0xoperation'});expect(w.account.signUserOperation).toHaveBeenCalledTimes(1);expect(w.client.sendUserOperation).toHaveBeenCalledTimes(1);});

test('real native transfer signs and sends the reviewed native value',async()=>{const w=wallet(),p=prepared(true);p.preview.mode='transfer';p.preview.action='transfer';p.preview.token='MON';p.preview.amount='0.01';p.preview.recipient='0x'+'2'.repeat(40);p.preview.transaction={to:p.preview.recipient as `0x${string}`,value:'10000000000000000',data:'0x'};validate(p);await confirm(session(w),p,operation,vi.fn());expect(w.account.encodeCalls).toHaveBeenCalledWith([{to:p.preview.recipient,value:10000000000000000n,data:'0x'}]);expect(w.client.sendUserOperation).toHaveBeenCalledOnce();});
test('requested sponsorship cannot silently become a user-paid transaction',async()=>{const w=wallet();Object.assign(w,{sponsorshipAvailable:true});await expect(estimate(session(w),prepared(true).preview,true)).rejects.toMatchObject({code:'sponsorship_unavailable'});expect(w.account.signUserOperation).not.toHaveBeenCalled();});

test('submission transport timeout records deterministic hash and prevents blind retry',async()=>{
 const w=wallet(),p=prepared(true),submitted=vi.fn();validate(p);
 Object.assign(w.account,{entryPoint:{address:'0x0000000071727De22E5E9d8BAf0edAc6f37da032',version:'0.7'}});
 w.client.sendUserOperation.mockRejectedValue(Object.assign(new Error('timed out'),{name:'TimeoutError'}));
 const full={operation:{sender:address,nonce:0n,callData:'0xcafe',callGasLimit:100000n,verificationGasLimit:200000n,preVerificationGas:50000n,maxFeePerGas:102000000000n,maxPriorityFeePerGas:1000000000n},maximumFeeMon:'0.0357',sponsored:false} as WalletEstimate;
 await expect(confirm(session(w),p,full,submitted)).rejects.toMatchObject({code:'receipt_pending'});
 expect(submitted).toHaveBeenCalledWith(expect.stringMatching(/^0x[0-9a-f]{64}$/));
 expect(w.client.sendUserOperation).toHaveBeenCalledOnce();expect(w.client.waitForUserOperationReceipt).not.toHaveBeenCalled();
});
test('definitive wallet rejection is not recorded as submitted',async()=>{
 const w=wallet(),p=prepared(true),submitted=vi.fn();validate(p);
 w.client.sendUserOperation.mockRejectedValue(Object.assign(new Error('rejected'),{name:'RpcRequestError',code:-32500}));
 await expect(confirm(session(w),p,operation,submitted)).rejects.toThrow('rejected');expect(submitted).not.toHaveBeenCalled();
});

test.each([403,429])('definitive HTTP %s denial is not an unknown submitted operation',async(status)=>{
 const w=wallet(),p=prepared(true),submitted=vi.fn();validate(p);
 w.client.sendUserOperation.mockRejectedValue(Object.assign(new Error('denied'),{name:'HttpRequestError',status}));
 await expect(confirm(session(w),p,operation,submitted)).rejects.toThrow('denied');expect(submitted).not.toHaveBeenCalled();
});
