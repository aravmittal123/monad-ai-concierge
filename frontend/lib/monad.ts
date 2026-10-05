import {createPublicClient, defineChain, http} from 'viem';
export const monad = defineChain({id:10143,name:'Monad Testnet',nativeCurrency:{name:'Monad',symbol:'MON',decimals:18},
  rpcUrls:{default:{http:['https://testnet-rpc.monad.xyz']}},
  blockExplorers:{default:{name:'Monadscan',url:'https://testnet.monadscan.com'}},testnet:true});
export function getPublicClient() {
  return createPublicClient({chain:monad,transport:http('/api/rpc',{retryCount:0,timeout:20000})});
}
export function shortAddress(value:string) {return `${value.slice(0,6)}…${value.slice(-4)}`;}
export function decimalLabel(value:string,maxDecimals=6) {
  const [whole,decimal='']=value.split('.');
  const fractional=decimal.slice(0,maxDecimals).replace(/0+$/,'');
  return fractional?`${whole}.${fractional}`:whole;
}
