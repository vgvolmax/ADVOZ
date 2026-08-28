'use strict';
const assert=require('assert');
const S=require('../calibration/schema.js');

assert.strictEqual(S.SCENARIO_SCHEMA_VERSION,'1.0.0');
assert.strictEqual(S.REPORT_SCHEMA_VERSION,'1.0.0');

const truth=S.freezeTruth({scenarioId:'x',nullEffect:true,regimes:[{start:0,end:9,cpc:14}]});
assert.ok(Object.isFrozen(truth));
assert.ok(Object.isFrozen(truth.regimes));
assert.ok(Object.isFrozen(truth.regimes[0]));
assert.throws(()=>{truth.regimes[0].cpc=99},TypeError);

const scenario={schemaVersion:S.SCENARIO_SCHEMA_VERSION,id:'clean-null',level:'A',parameters:{trueEffect:0},truth:{nullEffect:true}};
assert.doesNotThrow(()=>S.validateScenario(scenario));
assert.throws(()=>S.validateScenario({...scenario,id:''}),/scenario id/i);
assert.throws(()=>S.validateScenario({...scenario,schemaVersion:'0.9.0'}),/schema/i);

const report={
 schemaVersion:S.REPORT_SCHEMA_VERSION,
 metadata:{profile:'smoke',masterSeed:20260828,nodeVersion:process.version,scenarioSchemaVersion:S.SCENARIO_SCHEMA_VERSION},
 levels:{A:{},B1:{},B2:{},C:{}},sentinelFailures:[]
};
assert.doesNotThrow(()=>S.validateReport(report));
assert.throws(()=>S.validateReport({...report,levels:null}),/levels/i);

console.log('PASS calibration truth and schema contracts');
