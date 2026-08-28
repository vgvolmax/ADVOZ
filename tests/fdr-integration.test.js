const assert=require('assert');
const M=require('../src/multiple_testing.js');

const analyses=[
 {sku:'A',transitions:[{id:'T1',decision:'DEPLOY',uncertainty:{pValue:.01}}]},
 {sku:'B',transitions:[{id:'T2',decision:'ROLLBACK',uncertainty:{pValue:.08}}]},
 {sku:'C',transitions:[{id:'T3',decision:'EXTEND',uncertainty:{pValue:null}}]}
];
const out=M.applyFdrToCampaign(analyses,{alpha:.05});
const a=out.find(x=>x.sku==='A').transitions[0],b=out.find(x=>x.sku==='B').transitions[0],c=out.find(x=>x.sku==='C').transitions[0];
assert.strictEqual(a.fdrStatus,'FDR_PASS');
assert.strictEqual(a.decision,'DEPLOY');
assert.ok(a.qValue<=.05);
assert.strictEqual(b.fdrStatus,'FDR_NOT_PASS');
assert.strictEqual(b.decisionBeforeFdr,'ROLLBACK');
assert.strictEqual(b.decision,'INCONCLUSIVE');
assert.ok(b.qValue>.05);
assert.strictEqual(c.fdrStatus,'FDR_NOT_APPLICABLE');
assert.strictEqual(c.decision,'EXTEND');
assert.strictEqual(a.fdrFamilySize,2);
assert.strictEqual(b.fdrFamilySize,2);

console.log('PASS campaign FDR integration contracts');
