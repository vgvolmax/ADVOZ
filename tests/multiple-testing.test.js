const assert=require('assert');
const M=require('../src/multiple_testing.js');

const input=[
  {id:'a',pValue:.01},
  {id:'b',pValue:.04},
  {id:'c',pValue:.03},
  {id:'d',pValue:.20},
  {id:'e',pValue:null}
];
const out=M.benjaminiHochberg(input,{alpha:.05});
const by=new Map(out.map(x=>[x.id,x]));
function close(a,b,t=1e-6){assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`)}
close(by.get('a').qValue,.04);
close(by.get('b').qValue,.05333333333333334);
close(by.get('c').qValue,.05333333333333334);
close(by.get('d').qValue,.20);
assert.strictEqual(by.get('e').qValue,null);
assert.strictEqual(by.get('a').fdrStatus,'FDR_PASS');
assert.strictEqual(by.get('b').fdrStatus,'FDR_NOT_PASS');
assert.strictEqual(by.get('e').fdrStatus,'FDR_NOT_APPLICABLE');

// q-values must be monotone in sorted p order.
const sorted=out.filter(x=>Number.isFinite(x.pValue)).sort((a,b)=>a.pValue-b.pValue);
for(let i=1;i<sorted.length;i++) assert.ok(sorted[i].qValue>=sorted[i-1].qValue-1e-12);

console.log('PASS BH/FDR contracts');
