// Retry reads only. A send timeout is ambiguous and must never auto-resubmit.
export async function rpcFetch(url:string,body:{method?:string},origin:string){
  const retryable=!['eth_sendUserOperation','eth_sendRawTransaction','zd_sponsorUserOperation','pm_sponsorUserOperation','pm_getPaymasterData','pm_getPaymasterStubData'].includes(body.method??'');
  for(let attempt=0;;attempt++){
    try{
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(retryable?8000:25000)});
      if(!retryable||attempt||![429,502,503,504].includes(response.status))return response;
      await response.body?.cancel();
    }catch(error){if(!retryable||attempt)throw error;}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
}
