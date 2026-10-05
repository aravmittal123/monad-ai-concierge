import {expect,test} from 'vitest';
import {validContact} from '../lib/local-data';
test('contacts reject zero or incomplete addresses',()=>{expect(()=>validContact('Father','0x0')).toThrow();expect(()=>validContact('Father','0x'+'0'.repeat(40))).toThrow();});
test('contacts trim names and normalize valid addresses',()=>{expect(validContact(' Father ','0x'+'2'.repeat(40))).toEqual({name:'Father',address:'0x'+'2'.repeat(40)});});
test('contacts do not accept script-like names',()=>{expect(()=>validContact('<script>','0x'+'2'.repeat(40))).toThrow();});
