const assert=require('assert');
const F=require('../src/ui_format.js');

assert.strictEqual(F.cpc(15.3),'15,30 ₽');
assert.strictEqual(F.cpc(14),'14,00 ₽');
assert.strictEqual(F.cpc(null),'—');
assert.strictEqual(F.integerMoney(1234.4),'1 234 ₽');

console.log('PASS UI formatting preserves CPC precision');
