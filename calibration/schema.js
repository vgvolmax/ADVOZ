'use strict';

const SCENARIO_SCHEMA_VERSION='1.0.0';
const REPORT_SCHEMA_VERSION='1.0.0';

function cloneValue(v){
  if(Array.isArray(v))return v.map(cloneValue);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,cloneValue(x)]));
  return v;
}
function deepFreeze(v){
  if(v&&typeof v==='object'&&!Object.isFrozen(v)){
    Object.freeze(v);
    for(const x of Object.values(v))deepFreeze(x);
  }
  return v;
}
function freezeTruth(truth){return deepFreeze(cloneValue(truth||{}))}
function requireObject(v,name){if(!v||typeof v!=='object'||Array.isArray(v))throw new TypeError(`${name} must be an object`)}
function validateScenario(s){
  requireObject(s,'scenario');
  if(s.schemaVersion!==SCENARIO_SCHEMA_VERSION)throw new Error(`scenario schema must be ${SCENARIO_SCHEMA_VERSION}`);
  if(typeof s.id!=='string'||!s.id.trim())throw new Error('scenario id is required');
  if(!['A','B1','B2','B','C'].includes(s.level))throw new Error('scenario level is invalid');
  requireObject(s.parameters,'scenario parameters');
  requireObject(s.truth,'scenario truth');
  return true;
}
function validateReport(r){
  requireObject(r,'report');
  if(r.schemaVersion!==REPORT_SCHEMA_VERSION)throw new Error(`report schema must be ${REPORT_SCHEMA_VERSION}`);
  requireObject(r.metadata,'report metadata');
  if(r.metadata.scenarioSchemaVersion!==SCENARIO_SCHEMA_VERSION)throw new Error('report scenario schema mismatch');
  if(typeof r.metadata.profile!=='string'||!r.metadata.profile)throw new Error('report metadata profile is required');
  if(!Number.isFinite(Number(r.metadata.masterSeed)))throw new Error('report metadata masterSeed is required');
  requireObject(r.levels,'report levels');
  for(const k of ['A','B1','B2','C'])if(!(k in r.levels))throw new Error(`report levels.${k} is required`);
  if(!Array.isArray(r.sentinelFailures))throw new Error('report sentinelFailures must be an array');
  return true;
}
module.exports={SCENARIO_SCHEMA_VERSION,REPORT_SCHEMA_VERSION,freezeTruth,validateScenario,validateReport,_internals:{cloneValue,deepFreeze}};
