'use strict';
const assert=require('assert');
const {matchChangePoints,runPipelineReplication}=require('../calibration/runners/pipeline.js');

{
  const m=matchChangePoints(
    ['2026-07-02','2026-08-05'],
    ['2026-07-01','2026-07-31'],
    2
  );
  assert.equal(m.truePositives,1);
  assert.equal(m.falsePositives,1);
  assert.equal(m.falseNegatives,1);
  assert.equal(m.matches.length,1);
  assert.equal(m.matches[0].absErrorDays,1);
  assert.equal(m.recall,.5);
  assert.equal(m.precision,.5);
}

const scenario={id:'B-clean',parameters:{
  days:90,startDate:'2026-06-01',cpcRegimes:[{start:0,end:44,cpc:14},{start:45,end:89,cpc:16}],
  trueEffect:.25,trueLag:0,orderBaseMean:60,orderOverdispersion:.03,cpcNoiseSigma:.008,
  weekdayStrength:.3,ar1Phi:.15,ar1Sigma:.015
},expectations:{allowSupportedRecommendation:true,expectedTransitionClass:'CLEAN_CPC_TRANSITION'}};
const out=runPipelineReplication(scenario,2026,{
 cpc:{minDays:4,minRelativeChange:.05,noiseMultiplier:2.5},
 budget:{minRollingPoints:5},price:{minCoverage:.7,stableTolerance:.02},
 transitions:{priceChangeTolerance:.03,budgetCeilingTolerance:.15,maxDataGapDays:0},
 economics:{minOrderCoverage:.70},power:{mdeRelative:.20,maxTestDays:28},evaluator:{mdeRelative:.20},
 temporal:{lags:[0,1,2],maxLagSpread:.30},uncertainty:{reps:100,seed:91,blockSize:3},
 planner:{mdeRelative:.20,maxTestDays:28,minRelativeChange:.05},fdrAlpha:.05
});
assert.equal(out.truth.scenarioId,'B-clean');
assert.ok(out.analysis);
assert.ok(out.pipelineScore.changePoints);
assert.equal(typeof out.pipelineScore.changePoints.recall,'number');
assert.ok(Array.isArray(out.pipelineScore.detectedTransitionClasses));
assert.equal(typeof out.pipelineScore.classCorrect,'boolean');
assert.ok(out.decisionScore);

console.log('PASS B1 pipeline calibration contracts');
