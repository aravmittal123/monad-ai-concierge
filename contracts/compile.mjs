import fs from 'node:fs';
import solc from 'solc';
const input={language:'Solidity',sources:{'ConciergeActivity.sol':{content:fs.readFileSync(new URL('ConciergeActivity.sol',import.meta.url),'utf8')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input)));
if(output.errors?.some(e=>e.severity==='error'))throw new Error(output.errors.map(e=>e.formattedMessage).join('\n'));
const c=output.contracts['ConciergeActivity.sol'].ConciergeActivity;
fs.writeFileSync(new URL('../backend/app/constants/activity_registry.json',import.meta.url),JSON.stringify({compiler:solc.version(),abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtime:'0x'+c.evm.deployedBytecode.object},null,2));
console.log('Compiled ConciergeActivity; ABI and bytecode saved. No chain deployment performed.');
