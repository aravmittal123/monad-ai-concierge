import {NextRequest,NextResponse} from 'next/server';
import {backend,fail,guard} from '@/lib/gateway';
import {rpcError} from '@/lib/provider-errors';
import {p256Algorithms} from '@/lib/passkey-options';
import {rpcFetch} from '@/lib/rpc-fetch';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const rpcMethods=new Set(['eth_chainId','eth_blockNumber','eth_getBalance','eth_getCode','eth_call',
  'eth_estimateGas','eth_gasPrice','eth_maxPriorityFeePerGas','eth_feeHistory','eth_getBlockByNumber',
  'eth_getTransactionCount','eth_getTransactionReceipt','eth_getTransactionByHash']);
const bundlerMethods=new Set(['eth_chainId','eth_supportedEntryPoints','eth_estimateUserOperationGas',
  'eth_sendUserOperation','eth_getUserOperationReceipt','eth_getUserOperationByHash','zd_getUserOperationGasPrice']);
const paymasterMethods=new Set(['zd_sponsorUserOperation','pm_sponsorUserOperation','pm_getPaymasterData','pm_getPaymasterStubData']);

async function handle(request:NextRequest,{params}:{params:Promise<{path:string[]}>}) {
  try {
    const rejection=guard(request);if(rejection)return rejection;
    const {path}=await params;
    const name=path.join('/');
    let body:unknown=undefined;
    if(request.method==='POST') {
      const raw=await request.text();
      if(raw.length>100000)return fail('body_too_large','Request too large.',413);
      try{body=JSON.parse(raw);}catch{return fail('invalid_request','Invalid JSON.',400);}
    }
    if(['rpc','bundler','paymaster'].includes(name)) {
      if(request.method!=='POST' || !body || Array.isArray(body) || typeof body!=='object')return fail('invalid_rpc','Single RPC request required.',400);
      const rpcBody=body as {method?:string};
      const allowed=name==='rpc'?rpcMethods:name==='bundler'?bundlerMethods:paymasterMethods;
      if(!rpcBody.method || !allowed.has(rpcBody.method))return fail('rpc_method_rejected','RPC method is not allowed.',400);
      const url=name==='rpc'?(process.env.MONAD_RPC_URL??'https://testnet-rpc.monad.xyz'):
        name==='bundler'?process.env.ZERODEV_RPC_URL:(process.env.ZERODEV_PAYMASTER_URL||process.env.ZERODEV_RPC_URL);
      if(!url)return fail('wallet_not_configured','The app owner needs to configure the testnet wallet provider.');
      // ZeroDev checks the site's domain allowlist even behind our server proxy.
      // guard() has already rejected cross-origin browser requests.
      const origin=request.headers.get('origin')??request.nextUrl.origin;
      const response=await rpcFetch(url,body as {method?:string},origin);
      const data=await response.json();
      // EntryPoint.getSenderAddress intentionally reverts with the calculated
      // account encoded in error.data. The SDK must receive those ABI bytes.
      if(data.error)data.error=rpcError(data.error);
      // Preserve definitive denials so the wallet can distinguish them from an
      // ambiguous transport failure after submission.
      return NextResponse.json(data,{status:response.ok?200:[401,403,429].includes(response.status)?response.status:502,headers:{'Cache-Control':'no-store'}});
    }
    if(path[0]==='passkeys') {
      if(!['register/options','register/verify','login/options','login/verify'].includes(path.slice(1).join('/')) || request.method!=='POST')return fail('not_found','Endpoint not found.',404);
      const base=process.env.ZERODEV_PASSKEY_SERVER_URL;
      if(!base)return fail('wallet_not_configured','Passkey server URL is missing.');
      const response=await fetch(`${base.replace(/\/$/,'')}/${path.slice(1).join('/')}`,{method:'POST',
        headers:{'Content-Type':'application/json',Cookie:request.headers.get('cookie')??'',Origin:request.headers.get('origin')??request.nextUrl.origin},
        body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!response.ok)return fail('passkey_provider_error','Passkey provider failed. Check the project and allowed domain.',502);
      const data=await response.json();
      if(name==='passkeys/register/options') {
        // Kernel's passkey validator accepts ECDSA P-256, while the provider
        // also offers Ed25519/RSA. Those can register successfully but cannot
        // be imported by ZeroDev's P-256 signer. Advertise only ES256 (-7).
        const algorithms=data.options?.pubKeyCredParams;
        if(!Array.isArray(algorithms))return fail('passkey_provider_error','Passkey server returned invalid registration options.',502);
        const p256=p256Algorithms(algorithms);
        if(!p256.length)return fail('passkey_algorithm_unavailable','Passkey provider must support an ES256 (P-256) key for this wallet.',502);
        data.options.pubKeyCredParams=p256;
      }
      const result=NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
      for(const cookie of response.headers.getSetCookie()) {
        result.headers.append('Set-Cookie',cookie.replace(/;\s*Domain=[^;]+/ig,'').replace(/;\s*Path=[^;]+/ig,'; Path=/api/passkeys'));
      }
      return result;
    }
    const getAllowed=['health','config','gas'];
    const postAllowed=['chat','account','prepare','revalidate','activity'];
    if(path.length!==1 || !(request.method==='GET'?getAllowed:postAllowed).includes(name)) return fail('not_found','Endpoint not found.',404);
    if(request.method==='POST' && JSON.stringify(body).length>16000)return fail('body_too_large','Request too large.',413);
    const response=await backend(name==='health'?'health':`api/${name}`,body);
    const data=await response.json();
    if(name==='config' && response.ok) {
      data.wallet_configured=Boolean(process.env.ZERODEV_RPC_URL && process.env.ZERODEV_PASSKEY_SERVER_URL);
      data.sponsorship=process.env.SPONSOR_GAS==='true';
    }
    return NextResponse.json(data,{status:response.status,headers:{'Cache-Control':'no-store'}});
  } catch {
    return fail('service_unavailable','A service is unavailable or timed out. Please retry.');
  }
}
export const GET=handle;
export const POST=handle;
