const assert = require('assert');
const R=require('../src/response_curve.js');
const T=require('../src/test_planner.js');

function baseline(cpc=14,mean=100,variance=100){return {cpc,primaryMode:'orders',primaryKpiName:'orders/day',primaryMean:mean,primaryVariance:variance,nDays:14}}

{
  const curve=R.buildResponseCurve([
    {cpc:12,primaryMean:80,nDays:14,usable:true,evidenceType:'OBSERVATIONAL'},
    {cpc:14,primaryMean:100,nDays:14,usable:true,evidenceType:'OBSERVATIONAL'}
  ]);
  assert.strictEqual(curve.suggestDirection(14),'UP');
  const p=T.planNextTest({baselineMetrics:baseline(),cpcNoise:.008,responseCurve:curve},{mdeRelative:.20,maxTestDays:28,defaultStep:.05,maxStep:.15});
  assert.strictEqual(p.status,'RECOMMENDED');
  assert.ok(p.targetCpc>14);
  assert.strictEqual(p.evidenceType,'OBSERVATIONAL');
  for(const key of ['baselineAchievedCpc','targetCpc','targetCorridor','minSeparation','minFullDays','requiredPrimaryKpi','maxTestDays','stabilizationDays','stopLoss','mixedConditions','reloadWhen','possibleDecisions']) assert.ok(key in p.card,key);
}

{
  const curve=R.buildResponseCurve([{cpc:12,primaryMean:80,nDays:10,usable:true},{cpc:14,primaryMean:100,nDays:10,usable:true}]);
  const p=T.planNextTest({baselineMetrics:baseline(),cpcNoise:.09,responseCurve:curve},{mdeRelative:.20,maxTestDays:28,maxStep:.15,noiseMultiplier:2.5});
  assert.strictEqual(p.status,'NO_FEASIBLE_TEST');
  assert.strictEqual(p.reasonCode,'TEST_SEPARATION_INSUFFICIENT');
}

{
  const curve=R.buildResponseCurve([{cpc:10,primaryMean:60,nDays:10,usable:true},{cpc:15,primaryMean:100,nDays:10,usable:true}]);
  const p=T.planNextTest({baselineMetrics:baseline(15),cpcNoise:.005,responseCurve:curve},{mdeRelative:.20,maxTestDays:28,maxExtrapolationRelative:.10,maxStep:.15});
  assert.strictEqual(p.status,'RECOMMENDED');
  assert.ok(p.targetCpc<=16.5+1e-9);
}

{
  const curve=R.buildResponseCurve([{cpc:12,primaryMean:.15,nDays:14,usable:true},{cpc:14,primaryMean:.2,nDays:14,usable:true}]);
  const p=T.planNextTest({baselineMetrics:baseline(14,.2,.2),cpcNoise:.005,responseCurve:curve},{mdeRelative:.20,maxTestDays:28});
  assert.strictEqual(p.status,'NO_FEASIBLE_TEST');
  assert.strictEqual(p.reasonCode,'POWER_INFEASIBLE');
}

console.log('PASS response curve and next-test planner contracts');
