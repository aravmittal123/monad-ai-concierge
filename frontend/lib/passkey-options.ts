export function p256Algorithms(input:unknown):Array<{type:'public-key';alg:-7}> {
  if(!Array.isArray(input))return [];
  return input.filter(entry=>entry&&typeof entry==='object'&&entry.type==='public-key'&&entry.alg===-7)
    .map(()=>({type:'public-key',alg:-7}));
}
