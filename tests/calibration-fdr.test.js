'use strict';
const assert=require('assert');
const {scoreCampaignDiscoveries}=require('../calibration/metrics/fdr_metrics.js');
const {runCampaignReplication}=require('../calibration/runners/campaign.js');

{
  const analyses=[
    {sku:'A',transitions:[{fdrStatus:'FDR_PASS',fromCpc:14,toCpc:16,effectRelative:.2}]},
    {sku:'B',transitions:[{fdrStatus:'FDR_PASS',fromCpc:14,toCpc:16,effectRelative:.2}]},
    {sku:'C',transitions:[{fdrStatus:'FDR_NOT_PASS',fromCpc:14,toCpc:16,effectRelative:.2}]}
  ];
  const truth={A:{nullEffect:true,cpcElasticity:0},B:{nullEffect:false,cpcElasticity:1},C:{nullEffect:false,cpcElasticity:1}};
  const s=scoreCampaignDiscoveries(analyses,truth);
  assert.equal(s.discoveries,2);
  assert.equal(s.falseDiscoveries,1);
  assert.equal(s.trueDiscoveries,1);
  assert.equal(s.fdp,.5);
  assert.equal(s.trueDiscoveryRate,.5);
}

{
  const s=scoreCampaignDiscoveries([{sku:'A',transitions:[{fdrStatus:'FDR_NOT_PASS'}]}],{A:{nullEffect:true,cpcElasticity:0}});
  assert.equal(s.discoveries,0);assert.equal(s.fdp,0);
}

const out=runCampaignReplication({id:'C-shared',skuCount:4,nonNullFraction:.5,dependence:'shared-shock',parameters:{
  days:60,startDate:'2026-06-01',cpcRegimes:[{start:0,end:29,cpc:14},{start:30,end:59,cpc:16}],
  trueEffect:.25,orderBaseMean:50,cpcNoiseSigma:.008,sharedShockSigma:.08
}},42,{cpc:{minDays:4,minRelativeChange:.05},economics:{minOrderCoverage:.7},temporal:{lags:[0,1,2],maxLagSpread:.3},uncertainty:{reps:100,seed:44},power:{mdeRelative:.2,maxTestDays:28},planner:{mdeRelative:.2,maxTestDays:28},fdrAlpha:.05});
assert.equal(out.analyses.length,4);
assert.equal(Object.keys(out.truthBySku).length,4);
assert.equal(out.sharedShockSeries.length,60);
assert.ok(out.sharedShockSeries.some(x=>Math.abs(x)>0));
assert.ok(Number.isFinite(out.score.fdp));

console.log('PASS multi-SKU FDR calibration contracts');
