// Live read/estimate probe only. Never signs or submits; balance overrides are simulation-only.
import {generateKeyPairSync} from 'node:crypto';
import {createKernelAccount,createKernelAccountClient,getUserOperationGasPrice} from '@zerodev/sdk';
import {getEntryPoint,KERNEL_V3_3} from '@zerodev/sdk/constants';
import {toPasskeyValidator,PasskeyValidatorContractVersion} from '@zerodev/passkey-validator';
import {createPublicClient,http,defineChain,keccak256,parseEther,formatEther} from 'viem';
const base=process.env.APP_URL||'http://localhost:3000';
const chain=defineChain({id:10143,name:'Monad Testnet',nativeCurrency:{name:'MON',symbol:'MON',decimals:18},rpcUrls:{default:{http:[base+'/api/rpc']}}});
const transport=path=>http(base+path,{retryCount:0,timeout:20000,fetchOptions:{headers:{Origin:base}}});
const client=createPublicClient({chain,transport:transport('/api/rpc')});
const pub=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({format:'jwk'});
const webAuthnKey={pubX:BigInt('0x'+Buffer.from(pub.x,'base64url').toString('hex')),pubY:BigInt('0x'+Buffer.from(pub.y,'base64url').toString('hex')),authenticatorId:'diagnostic',authenticatorIdHash:keccak256('0x1234'),rpID:new URL(base).hostname,signMessageCallback:()=>{throw new Error('Signing prohibited in diagnostic');}};
try{
 const validator=await toPasskeyValidator(client,{webAuthnKey,entryPoint:getEntryPoint('0.7'),kernelVersion:KERNEL_V3_3,validatorContractVersion:PasskeyValidatorContractVersion.V0_0_3_PATCHED});
 const account=await createKernelAccount(client,{plugins:{sudo:validator},entryPoint:getEntryPoint('0.7'),kernelVersion:KERNEL_V3_3});
 const wallet=createKernelAccountClient({account,chain,client,bundlerTransport:transport('/api/bundler'),userOperation:{estimateFeesPerGas:({bundlerClient})=>getUserOperationGasPrice(bundlerClient)}});
 const fee=await wallet.prepareUserOperation({calls:[{to:'0x2222222222222222222222222222222222222222',value:parseEther('0.001'),data:'0x'}],stateOverride:[{address:account.address,balance:parseEther('100')}]});
 const gas=fee.callGasLimit+fee.verificationGasLimit+fee.preVerificationGas;
 console.log('PASS live counterfactual P-256 account and bundler fee simulation:',formatEther(gas*fee.maxFeePerGas),'MON cap. Balance override used; no signing or sending.');
}catch(e){console.error('FAIL sanitized diagnostic:',e.shortMessage||e.name);const msg=String(e.message);console.error(msg.includes('allowlist')?'ZeroDev domain allowlist rejected.':msg.match(/Details: ([^\n]+)/)?.[1]?.replace(/https?:\/\/\S+/g,'[url]')||'Provider did not complete estimation.');process.exitCode=1;}
