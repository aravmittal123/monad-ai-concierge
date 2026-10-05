import {expect,test} from 'vitest';
import {p256Algorithms} from '../lib/passkey-options';
test('registration cannot select provider-preferred Ed25519 or RSA instead of the wallet P-256 key',()=>{
 expect(p256Algorithms([{type:'public-key',alg:-8},{type:'public-key',alg:-7},{type:'public-key',alg:-257}]))
  .toEqual([{type:'public-key',alg:-7}]);
});
test('a provider without P-256 support cannot silently register an incompatible wallet key',()=>{
 expect(p256Algorithms([{type:'public-key',alg:-8},{type:'public-key',alg:-257}])).toEqual([]);
});
test('invalid registration parameters cannot throw or bypass key restrictions',()=>{
 expect(p256Algorithms(null)).toEqual([]);
 expect(p256Algorithms([null,{type:'password',alg:-7},{type:'public-key',alg:'-7'},{}])).toEqual([]);
});
