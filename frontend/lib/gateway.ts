import {NextRequest,NextResponse} from 'next/server';
const buckets=new Map<string,{started:number;count:number}>();
export function fail(code:string,message:string,status=503) {
  return NextResponse.json({error:{code,message}},{status,headers:{'Cache-Control':'no-store'}});
}
export function guard(request:NextRequest) {
  const origin=request.headers.get('origin');
  if (origin && new URL(origin).host!==request.headers.get('host')) return fail('origin_rejected','Request origin rejected.',403);
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim()??'local';
  const now=Date.now();
  if(buckets.size>2000) buckets.clear();
  const bucket=buckets.get(ip);
  if(!bucket || now-bucket.started>60000) buckets.set(ip,{started:now,count:1});
  else {
    bucket.count++;
    if(bucket.count>100) return fail('rate_limited','Too many requests. Wait a minute.',429);
  }
  return null;
}
export async function backend(path:string,body?:unknown) {
  const url=process.env.BACKEND_URL??'http://127.0.0.1:8000';
  return fetch(`${url.replace(/\/$/,'')}/${path}`,{method:body===undefined?'GET':'POST',
    headers:{'Content-Type':'application/json','X-API-Token':process.env.BACKEND_API_TOKEN??''},
    body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(50000)});
}
