'use client';
import {createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient, getUserOperationGasPrice} from '@zerodev/sdk';
import {getEntryPoint,KERNEL_V3_3} from '@zerodev/sdk/constants';
import {toPasskeyValidator,toWebAuthnKey,WebAuthnMode,PasskeyValidatorContractVersion} from '@zerodev/passkey-validator';
import {http,formatEther,parseGwei} from 'viem';
import {getUserOperationHash} from 'viem/account-abstraction';
import {monad,getPublicClient} from './monad';
import {api,ApiError} from './api';
import type {Prepared,Preview,RuntimeConfig,TransactionResult} from './types';

async function makeAccount(name:string,register:boolean,config:RuntimeConfig) {
  if (!window.isSecureContext || !window.PublicKeyCredential) throw new ApiError('passkey_unsupported','Open this app over HTTPS or localhost on a passkey-capable device.');
  if(window.location.hostname==='127.0.0.1'||window.location.hostname==='[::1]')throw new ApiError('passkey_domain','For local passkey testing, open http://localhost:3000 instead of an IP address.');
  if (!config.wallet_configured) throw new ApiError('wallet_not_configured','The app owner needs to configure the ZeroDev testnet project.');
  const publicClient=getPublicClient();
  if (await publicClient.getChainId()!==10143) throw new ApiError('wrong_chain','The wallet RPC is not Monad Testnet.');
  let webAuthnKey;
  try {
    webAuthnKey=await toWebAuthnKey({passkeyName:name,passkeyServerUrl:`${window.location.origin}/api/passkeys`,
      rpID:window.location.hostname,mode:register?WebAuthnMode.Register:WebAuthnMode.Login,passkeyServerHeaders:{}});
  } catch(error) {
    if(error instanceof Error&&['Registration not verified','Login not verified'].includes(error.message))throw new ApiError('passkey_verification_failed','ZeroDev could not verify the passkey. For localhost, leave the passkey domain empty in ZeroDev; for deployment, configure the exact hostname.');
    if(error instanceof Error&&error.message==='No public key returned from registration credential')throw new ApiError('passkey_public_key_missing','Your authenticator did not return a public key. Try a current Chrome or Edge browser with Windows Hello or a supported passkey device.');
    if(error&&typeof error==='object'&&'name' in error) {
      if(error.name==='SecurityError')throw new ApiError('passkey_domain',window.location.hostname==='localhost'
        ?'The passkey domain was rejected. For localhost testing, leave the ZeroDev passkey domain empty.'
        :`ZeroDev returned a passkey domain that this website cannot use. Set the project passkey domain to ${window.location.hostname}, then retry. Localhost passkeys are separate.`);
      if(error.name==='NotAllowedError'||error.name==='AbortError')throw new ApiError('passkey_cancelled','Passkey creation or login was cancelled or timed out. Try again when your device is ready.');
      if(error.name==='DataError')throw new ApiError('passkey_key_type','This passkey has an incompatible key type. Create a new passkey using the updated app and choose that new passkey when logging in.');
    }
    throw new ApiError('passkey_registration_failed','Passkey registration or login could not complete. Check the ZeroDev passkey server and domain settings, then retry.');
  }
  const entryPoint=getEntryPoint('0.7');
  const validator=await toPasskeyValidator(publicClient,{webAuthnKey,entryPoint,kernelVersion:KERNEL_V3_3,
    validatorContractVersion:PasskeyValidatorContractVersion.V0_0_3_PATCHED});
  const account=await createKernelAccount(publicClient,{plugins:{sudo:validator},entryPoint,kernelVersion:KERNEL_V3_3});
  const paymaster=createZeroDevPaymasterClient({chain:monad,transport:http('/api/paymaster',{retryCount:0,timeout:20000})});
  const client=createKernelAccountClient({account,chain:monad,client:publicClient,
    bundlerTransport:http('/api/bundler',{retryCount:0,timeout:35000}),
    userOperation:{estimateFeesPerGas:async({bundlerClient})=>getUserOperationGasPrice(bundlerClient)},
  });
  // Keep signer and credential material in memory, never in localStorage/backend.
  return {address:account.address,account,client,publicClient,sponsorshipAvailable:config.sponsorship,paymaster};
}
export type WalletSession = Awaited<ReturnType<typeof makeAccount>>;
export const loginPasskey=makeAccount;
export type UserOp = Awaited<ReturnType<WalletSession['client']['prepareUserOperation']>>;
export type WalletEstimate = {operation:UserOp; maximumFeeMon:string; sponsored:boolean};
function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}

export async function estimate(wallet:WalletSession,preview:Preview,requestSponsorship=false):Promise<WalletEstimate|null> {
  if (preview.mode==='mock') return null;
  if (!preview.transaction) throw new ApiError('invalid_preview','Missing unsigned transaction.');
  const tx=preview.transaction;
  if(requestSponsorship&&!wallet.sponsorshipAvailable)throw new ApiError('sponsorship_unavailable','Gas sponsorship has not been enabled for this app.');
  const operation=await wallet.client.prepareUserOperation({calls:[{to:tx.to,value:BigInt(tx.value),data:tx.data}],
    ...(requestSponsorship?{paymaster:{getPaymasterData:async(operation)=>wallet.paymaster.sponsorUserOperation({userOperation:operation})}}:{})});
  const fees=operation.maxFeePerGas??0n;
  if (preview.max_gas_price_gwei && fees>=parseGwei(preview.max_gas_price_gwei)) throw new ApiError('gas_limit_exceeded','Bundler fee cap exceeds your gas limit. No passkey approval requested.');
  const gas=(operation.callGasLimit??0n)+(operation.verificationGasLimit??0n)+(operation.preVerificationGas??0n)+
    (operation.paymasterVerificationGasLimit??0n)+(operation.paymasterPostOpGasLimit??0n);
  const fee=fees*gas;
  const sponsored=Boolean(operation.paymaster);
  if(requestSponsorship&&!sponsored)throw new ApiError('sponsorship_unavailable','The paymaster did not sponsor this operation. Turn sponsorship off to review a self-funded fee.');
  const balance=await wallet.publicClient.getBalance({address:wallet.address});
  if (balance<BigInt(tx.value)+(sponsored?0n:fee)) throw new ApiError('insufficient_balance','Fund your smart account with enough testnet MON for this amount and the full wallet fee.');
  return {operation,maximumFeeMon:formatEther(fee),sponsored};
}

export async function confirm(wallet:WalletSession,prepared:Prepared,estimateResult:WalletEstimate|null,
  onSubmitted:(hash:`0x${string}`)=>void):Promise<TransactionResult> {
  if (prepared.preview.wallet_address.toLowerCase()!==wallet.address.toLowerCase()) throw new ApiError('account_mismatch','Reconnect the smart account used for this preview.');
  const fresh=await api<{preview:Preview;approval_message:string}>('revalidate',{
    wallet_address:wallet.address,preview_token:prepared.preview_token});
  if (canonical(fresh.preview)!==canonical(prepared.preview)) throw new ApiError('preview_changed','Preview changed; review a new one.');
  if (await wallet.publicClient.getChainId()!==10143) throw new ApiError('wrong_chain','Wallet chain is not Monad Testnet.');
  if (fresh.preview.mode==='mock') {
    const signature=await wallet.client.signMessage({message:fresh.approval_message});
    const valid=await wallet.publicClient.verifyMessage({address:wallet.address,message:fresh.approval_message,signature});
    if (!valid) throw new ApiError('signature_invalid','Passkey approval could not be verified.');
    if (fresh.preview.expires_at*1000<=Date.now()) throw new ApiError('preview_expired','Approval expired. Prepare a new preview.');
    return {kind:'rehearsal',approvalId:fresh.preview.preview_id};
  }
  if (!estimateResult || !fresh.preview.transaction) throw new ApiError('simulation_required','Estimate the full wallet operation before confirming.');
  // Sign the exact gas-estimated operation shown in the preview. Do not rebuild during signing.
  const operation=estimateResult.operation;
  const tx=fresh.preview.transaction;
  const expected=await wallet.account.encodeCalls([{to:tx.to,value:BigInt(tx.value),data:tx.data}]);
  if (operation.callData!==expected) throw new ApiError('call_changed','Unsigned operation changed. Prepare again.');
  const signature=await wallet.account.signUserOperation(operation);
  // A passkey prompt may take long: recheck expiry and policy after signing, before submission.
  await api('revalidate',{wallet_address:wallet.address,preview_token:prepared.preview_token});
  let userOpHash:`0x${string}`;
  try{userOpHash=await wallet.client.sendUserOperation({...operation,signature});}
  catch(error){
    // A transport failure can happen after the bundler accepted the operation.
    // Keep its deterministic hash for receipt lookup instead of encouraging a resend.
    let current:unknown=error,uncertain=false;
    for(let i=0;i<8&&current&&typeof current==='object';i++){
      const e=current as {name?:string;status?:number;message?:string;cause?:unknown};
      if(e.status&&e.status>=400&&e.status<500){uncertain=false;break;}
      if(e.status&&e.status>=500||/Timeout|Abort|HttpRequest|Socket|TypeError/.test(e.name??'')||/service is unavailable or timed out/i.test(e.message??''))uncertain=true;
      current=e.cause;
    }
    if(uncertain){
      const hash=getUserOperationHash({userOperation:{...operation,signature},chainId:10143,entryPointAddress:wallet.account.entryPoint.address,entryPointVersion:'0.7'});
      onSubmitted(hash);
      throw new ApiError('receipt_pending','The wallet provider did not acknowledge submission. Its outcome is unknown. Check this operation’s receipt in Recent Activity before sending again.');
    }
    throw error;
  }
  onSubmitted(userOpHash);
  let receipt;
  try {receipt=await wallet.client.waitForUserOperationReceipt({hash:userOpHash,timeout:120000});}
  catch {throw new ApiError('receipt_pending','Transaction submitted; receipt is still pending. Keep its operation hash and check the explorer before retrying.');}
  if (!receipt.success || receipt.receipt.status!=='success') throw new ApiError('transaction_reverted','The operation was mined but reverted. The payment or swap did not complete.');
  return {kind:'transaction',hash:receipt.receipt.transactionHash,userOpHash};
}
