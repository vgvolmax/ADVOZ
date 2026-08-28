const assert=require('assert');
const V=require('../src/transition_evaluator.js');

function iso(start,offset){const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)}
function regime(id,start,values,cpc){return {id,startDate:iso(start,0),endDate:iso(start,values.length-1),nDays:values.length,cpcMedian:cpc,days:values.map((y,i)=>({date:iso(start,i),safeOrderReliable:true,safeOrderUnits:y}))}}
function metric(id,values,cpc){const mean=values.reduce((s,x)=>s+x,0)/values.length;return {regimeId:id,nDays:values.length,cpc,primaryMode:'orders',primaryKpiName:'orders/day',primaryMean:mean,primaryVariance:mean,primaryDaily:values}}
const tr={id:'T1',fromRegimeId:'R1',toRegimeId:'R2',code:'CLEAN_CPC_TRANSITION',evidenceType:'OBSERVATIONAL'};

// Stable uplift that survives weekday/trend adjustment may still DEPLOY, but is explicitly temporal-adjusted observational evidence.
{
  const aVals=Array(21).fill(50),bVals=Array(21).fill(70);
  const a=regime('R1','2026-06-01',aVals,14),b=regime('R2','2026-06-22',bVals,16);
  const [out]=V.evaluateTransitions([tr],[metric('R1',aVals,14),metric('R2',bVals,16)],{mdeRelative:.20,maxTestDays:28,regimes:[a,b],temporal:{lags:[0,1,2]}});
  assert.strictEqual(out.temporal.status,'LAG_STABLE');
  assert.strictEqual(out.effectSource,'TEMPORAL_ADJUSTED');
  assert.strictEqual(out.basis,'OBSERVATIONAL');
  assert.strictEqual(out.decision,'DEPLOY');
}

// If local temporal model cannot identify lag/trend/weekday effect, strong DEPLOY/ROLLBACK claims are blocked.
{
  const aVals=[50,50,50,50,50,50],bVals=[80,80,80,80,80,80];
  const a=regime('R1','2026-07-01',aVals,14),b=regime('R2','2026-07-07',bVals,16);
  const [out]=V.evaluateTransitions([tr],[metric('R1',aVals,14),metric('R2',bVals,16)],{mdeRelative:.20,maxTestDays:28,regimes:[a,b],temporal:{lags:[0,1,2]}});
  assert.strictEqual(out.temporal.status,'LAG_NOT_IDENTIFIED');
  assert.strictEqual(out.decision,'INCONCLUSIVE');
  assert.match(out.decisionReason,/temporal|lag|врем/i);
}

console.log('PASS transition temporal integration contracts');
