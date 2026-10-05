// Preserve only bounded ABI revert bytes. Never return raw provider messages,
// URLs, cookies, or arbitrary diagnostic objects to the browser.
export function rpcError(error:unknown):{code:number;message:string;data?:string} {
  const source=error&&typeof error==='object'?error as {code?:unknown;data?:unknown}:{};
  const result:{code:number;message:string;data?:string}={
    code:typeof source.code==='number'?source.code:-32000,
    message:'Provider rejected this operation. Check project configuration, gas policy, account balance and network.',
  };
  const message=typeof error==='string'?error:typeof (source as {message?:unknown}).message==='string'?(source as {message:string}).message:'';
  if(/allowlist|whitelist|allowed (?:domain|origin)/i.test(message))result.message='Wallet domain is not allowed by ZeroDev. Add this website origin to the project RPC domain allowlist, then retry the fee estimate.';
  else if(/AA21|prefund|insufficient funds|insufficient balance/i.test(message))result.message='The smart account needs more testnet MON for the amount and wallet deployment/gas fee. Fund the connected smart-account address, then retry.';
  else if(/rate limit|too many requests|quota/i.test(message))result.message='Wallet provider request limit reached. Wait briefly, then retry the fee estimate.';
  else if(/invalid.*(?:key|project)|unauthorized|forbidden/i.test(message))result.message='ZeroDev rejected the project configuration. Check the bundler URL and project access settings.';
  let data=source.data;
  if(data&&typeof data==='object'&&'data' in data)data=data.data;
  if(typeof data==='string'&&data.length<=32768&&/^0x(?:[a-fA-F0-9]{2})*$/.test(data))result.data=data;
  return result;
}
