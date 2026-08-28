'use strict';
const assert=require('assert');
const {runEstimatorReplication}=require('../calibration/runners/estimator.js');
const {aggregateEstimatorScores}=require('../calibration/metrics/estimator_metrics.js');
const {wilsonInterval}=require('../calibration/metrics/monte_carlo_ci.js');

{
  const w=wilsonInterval(5,10,.95);
  assert.ok(w.low<.5&&w.high>.5);
  assert.equal(w.successes,5);assert.equal(w.total,10);
}

const scenario={id:'A-strong',parameters:{
  days:90,startDate:'2026-06-01',cpcRegimes:[{start:0,end:44,cpc:14},{start:45,end:89,cpc:16}],
  trueEffect:.30,trueLag:1,orderBaseMean:80,orderOverdispersion:.02,cpcNoiseSigma:0,
  weekdayStrength:.5,linearTrend:.001,ar1Phi:.2,ar1Sigma:.02
}};
const score=runEstimatorReplication(scenario,12345,{temporal:{lags:[0,1,2],maxLagSpread:.30},uncertainty:{reps:120,seed:77,blockSize:3}});
assert.equal(score.scenarioId,'A-strong');
assert.equal(score.trueEffect,.30);
assert.equal(score.trueLag,1);
assert.ok(['LAG_STABLE','LAG_SENSITIVE','LAG_NOT_IDENTIFIED'].includes(score.lagStatus));
assert.equal(typeof score.identified,'boolean');
assert.ok('effectEstimate' in score);
assert.ok('ciCovered' in score);
assert.ok('signRecovered' in score);
assert.ok('pValue' in score);
if(score.identified){assert.ok(Number.isFinite(score.effectEstimate));assert.ok(score.ci&&Number.isFinite(score.ci.low)&&Number.isFinite(score.ci.high))}

const agg=aggregateEstimatorScores([
 {trueEffect:0,identified:true,strongFalsePositive:false,ciCovered:true,ciWidth:.4,signRecovered:null},
 {trueEffect:0,identified:true,strongFalsePositive:true,ciCovered:false,ciWidth:.3,signRecovered:null},
 {trueEffect:.2,identified:true,strongFalsePositive:false,ciCovered:true,ciWidth:.2,signRecovered:true},
 {trueEffect:.2,identified:false,strongFalsePositive:false,ciCovered:false,ciWidth:null,signRecovered:false}
]);
assert.equal(agg.replications,4);
assert.equal(agg.identificationRate.estimate,.75);
assert.equal(agg.strongFalsePositiveRate.estimate,.5);
assert.equal(agg.signRecoveryAll.estimate,.5);
assert.equal(agg.signRecoveryIdentified.estimate,1);
assert.equal(agg.ciCoverageIdentified.estimate,2/3);
assert.ok(agg.meanCiWidth>0);

console.log('PASS estimator Monte-Carlo calibration contracts');
