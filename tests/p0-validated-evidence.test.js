'use strict';
const assert=require('assert');
const A=require('../src/analyzer.js');

const metrics=[
 {regimeId:'R1',cpc:14,primaryMean:10,primaryVariance:10,nDays:20,primaryMode:'orders',primaryKpiName:'orders/day',primaryUsable:true},
 {regimeId:'R2',cpc:16,primaryMean:12,primaryVariance:12,nDays:20,primaryMode:'orders',primaryKpiName:'orders/day',primaryUsable:true}
];
const by=new Map(metrics.map(x=>[x.regimeId,x]));
function transition(overrides={}){return{
 id:'T1',fromRegimeId:'R1',toRegimeId:'R2',code:'CLEAN_CPC_TRANSITION',effectRelative:.2,
 temporal:{status:'LAG_STABLE'},uncertainty:{status:'UNCERTAINTY_IDENTIFIED',ci:{low:.05,high:.35},pValue:.01},
 fdrStatus:'FDR_PASS',qValue:.02,...overrides
}}

assert.equal(A._internals.isValidatedTransition(transition(),by),true);
assert.equal(A._internals.isValidatedTransition(transition({fdrStatus:'FDR_NOT_PASS'}),by),false);
assert.equal(A._internals.isValidatedTransition(transition({uncertainty:{status:'UNCERTAINTY_NOT_IDENTIFIED',ci:null,pValue:null}}),by),false);

const lowMetrics=metrics.map(x=>({...x,primaryUsable:x.regimeId==='R2'?false:true}));
assert.equal(A._internals.isValidatedTransition(transition(),new Map(lowMetrics.map(x=>[x.regimeId,x]))),false);

const base={
 sku:'SKU1',name:'x',cpcNoise:.01,cpcRegimes:[{id:'R1',cpc:14},{id:'R2',cpc:16}],regimeMetrics:metrics,
 transitions:[transition({fdrStatus:'FDR_NOT_PASS'})],currentRegime:{id:'R2',cpc:16},dataQuality:{orderReliableCoverage:1}
};
const rejected=A._internals.finalizeSkuAfterFdr(base,{power:{mdeRelative:.2,maxTestDays:28},planner:{mdeRelative:.2,maxTestDays:28}});
assert.equal(rejected.responseCurve.points.length,0);
assert.equal(rejected.recommendation.status,'NO_FEASIBLE_TEST');

const accepted=A._internals.buildValidatedResponseEvidence({...base,transitions:[transition()]});
assert.equal(accepted.length,2);
assert.ok(accepted.every(x=>x.validationStatus==='VALIDATED'));

console.log('PASS post-FDR validated response evidence contracts');
