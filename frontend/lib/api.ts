export class ApiError extends Error {
  constructor(public code:string, message:string) {super(message); this.name='ApiError';}
}
export async function api<T>(path:string, body?:unknown):Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method:body===undefined?'GET':'POST', headers:{'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body), cache:'no-store', signal:AbortSignal.timeout(60000),
  });
  let data;
  try {data=await response.json();} catch {throw new ApiError('bad_gateway','The service returned an unreadable response. Please retry.');}
  if (!response.ok) throw new ApiError(data.error?.code??'unavailable',data.error?.message??'The service is unavailable. Please retry.');
  return data as T;
}
export function friendlyError(error:unknown):string {
  if (error instanceof ApiError) {
    if(error.code==='invalid_ai_response')return "I'm having trouble understanding safely. Try rephrasing, or use an exact command like Check my balance.";
    return error.message;
  }
  if (error instanceof DOMException && ['NotAllowedError','AbortError'].includes(error.name)) return 'Passkey approval was cancelled or timed out. Nothing was approved.';
  // Only surface our fixed, sanitized gateway diagnostics from nested SDK errors.
  const text=error instanceof Error?error.message:'';
  for(const message of ['Wallet domain is not allowed by ZeroDev. Add this website origin to the project RPC domain allowlist, then retry the fee estimate.',
    'The smart account needs more testnet MON for the amount and wallet deployment/gas fee. Fund the connected smart-account address, then retry.',
    'Wallet provider request limit reached. Wait briefly, then retry the fee estimate.',
    'ZeroDev rejected the project configuration. Check the bundler URL and project access settings.'])if(text.includes(message))return message;
  // Do not expose raw provider errors, URLs or authentication material.
  return 'The wallet or network request could not finish. Check connectivity and try again; verify pending transactions before resubmitting.';
}
