'use strict';
const assert=require('assert');
const {createRng}=require('../calibration/rng.js');
const {generateOzonHistory}=require('../calibration/dgp/ozon_history.js');
const {generateLatentSeries}=require('../calibration/dgp/time_series.js');
const {ADVERSARIAL_SCENARIOS,getAdversarialScenario}=require('../calibration/scenarios/adversarial.js');
const N=require('../src/normalize.js');

{
  const x=generateOzonHistory({
    id:'missing-spend',days:30,startDate:'2026-06-01',
    cpcRegimes:[{start:0,end:29,cpc:14}],cpcNoiseSigma:0,
    missingSpendRate:1,orderBaseMean:12
  },createRng(1));
  assert.equal(x.rows.length,30);
  assert.ok(x.rows.every(r=>r.spend==null));
  assert.ok(x.rows.every(r=>r.reportedCpc>0));
  assert.ok(x.rows.every(r=>N.actualCpc(r)>0));
  assert.ok(!('truth' in x.rows[0]));
  assert.ok(Object.isFrozen(x.truth));
  assert.ok(Object.isFrozen(x.truth.cpcRegimes));
}

{
  const x=generateOzonHistory({
    id:'aba',days:30,startDate:'2026-06-01',cpcNoiseSigma:0,
    cpcRegimes:[{start:0,end:9,cpc:14},{start:10,end:19,cpc:16},{start:20,end:29,cpc:14}],
    orderBaseMean:20,trueEffect:.2,trueLag:0
  },createRng(2));
  assert.deepStrictEqual(x.truth.cpcRegimes.map(r=>r.cpc),[14,16,14]);
  assert.deepStrictEqual(x.truth.changePointIndices,[10,20]);
  assert.equal(x.rows[0].reportedCpc,14);
  assert.equal(x.rows[10].reportedCpc,16);
  assert.equal(x.rows[20].reportedCpc,14);
}

{
  const x=generateOzonHistory({
    id:'gap',days:20,startDate:'2026-06-01',gapIndices:[8,9,10],
    cpcRegimes:[{start:0,end:7,cpc:14},{start:11,end:19,cpc:16}],cpcNoiseSigma:0,orderBaseMean:10
  },createRng(3));
  assert.equal(x.rows.length,17);
  assert.deepStrictEqual(x.truth.gapIndices,[8,9,10]);
  assert.ok(!x.rows.some(r=>['2026-06-09','2026-06-10','2026-06-11'].includes(r.date)));
}

{
  const latent=generateLatentSeries({days:3,baseDemand:1,weekdayStrength:0,linearTrend:0,ar1Sigma:0,sharedShockSeries:[0,.6,0]},createRng(4));
  assert.ok(latent.demand[1]>latent.demand[0]);
  assert.ok(latent.demand[1]>latent.demand[2]);
  assert.deepStrictEqual(latent.sharedShock,[0,.6,0]);
}

assert.equal(ADVERSARIAL_SCENARIOS.length,16);
const noisy=getAdversarialScenario('cpc-separation-below-noise');
assert.ok(noisy);
assert.equal(noisy.expectations.allowSupportedRecommendation,false);
assert.ok(noisy.parameters.cpcNoiseSigma>0);
assert.ok(Math.abs(noisy.parameters.cpcRegimes[1].cpc/noisy.parameters.cpcRegimes[0].cpc-1)<noisy.parameters.nominalNoiseGuard);

const fallback=getAdversarialScenario('missing-spend-valid-cpc');
assert.equal(fallback.expectations.mustNeverCreateZeroCpc,true);

console.log('PASS calibration DGP sentinel contracts');
