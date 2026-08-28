const assert=require('assert');
const T=require('../src/temporal_adjustment.js');

function iso(start,offset){const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)}
function regime(id,start,values){
  return {
    id,startDate:iso(start,0),endDate:iso(start,values.length-1),nDays:values.length,
    days:values.map((y,i)=>({date:iso(start,i),safeOrderReliable:true,safeOrderUnits:y}))
  };
}
function metrics(id,values){
  const m=values.reduce((s,x)=>s+x,0)/values.length;
  return {regimeId:id,primaryMode:'orders',primaryKpiName:'orders/day',primaryMean:m};
}
function transition(){return {id:'T1',code:'CLEAN_CPC_TRANSITION',evidenceType:'OBSERVATIONAL'};}
function close(a,b,t=.05){assert.ok(Math.abs(a-b)<=t,`${a} not within ${t} of ${b}`)}

// Unequal weekday composition creates a raw mean difference, but weekday FE should remove it.
{
  const weekdayValue=d=>[8,10,10,10,10,10,20][new Date(d+'T00:00:00Z').getUTCDay()];
  const aDates=Array.from({length:14},(_,i)=>iso('2026-06-01',i));
  const bDates=Array.from({length:8},(_,i)=>iso('2026-06-13',i));
  const aVals=aDates.map(weekdayValue),bVals=bDates.map(weekdayValue);
  const a=regime('R1','2026-06-01',aVals),b=regime('R2','2026-06-13',bVals);
  const raw=bVals.reduce((s,x)=>s+x,0)/bVals.length/(aVals.reduce((s,x)=>s+x,0)/aVals.length)-1;
  assert.ok(Math.abs(raw)>.05);
  const out=T.evaluateTemporalTransition(transition(),a,b,metrics('R1',aVals),metrics('R2',bVals),{lags:[0]});
  assert.strictEqual(out.lagResults[0].status,'IDENTIFIED');
  close(out.lagResults[0].adjustedEffectRelative,0,.03);
}

// Pure linear calendar trend should not be attributed wholesale to the CPC regime step.
{
  const start='2026-07-01';
  const all=Array.from({length:28},(_,i)=>10+0.5*i);
  const aVals=all.slice(0,14),bVals=all.slice(14);
  const a=regime('R1',start,aVals),b=regime('R2',iso(start,14),bVals);
  const raw=(bVals.reduce((s,x)=>s+x,0)/14)/(aVals.reduce((s,x)=>s+x,0)/14)-1;
  assert.ok(raw>.4);
  const out=T.evaluateTemporalTransition(transition(),a,b,metrics('R1',aVals),metrics('R2',bVals),{lags:[0]});
  assert.strictEqual(out.lagResults[0].status,'IDENTIFIED');
  close(out.lagResults[0].adjustedEffectRelative,0,.05);
}

// If effect starts after two days, lag=2 should recover more of it than lag=0.
{
  const aVals=Array(14).fill(20);
  const bVals=[20,20,...Array(12).fill(30)];
  const a=regime('R1','2026-08-01',aVals),b=regime('R2','2026-08-15',bVals);
  const out=T.evaluateTemporalTransition(transition(),a,b,metrics('R1',aVals),metrics('R2',bVals),{lags:[0,1,2]});
  const r0=out.lagResults.find(x=>x.lag===0),r2=out.lagResults.find(x=>x.lag===2);
  assert.strictEqual(r0.status,'IDENTIFIED');
  assert.strictEqual(r2.status,'IDENTIFIED');
  assert.ok(r2.adjustedEffectRelative>r0.adjustedEffectRelative);
  assert.ok(r2.adjustedEffectRelative>.35);
}

// Conflicting signs across identifiable lags are explicitly sensitive, never averaged into certainty.
{
  const s=T._internals.summarizeLagResults([
    {lag:0,status:'IDENTIFIED',adjustedEffectRelative:-.15},
    {lag:1,status:'IDENTIFIED',adjustedEffectRelative:.05},
    {lag:2,status:'IDENTIFIED',adjustedEffectRelative:.22}
  ],{signEpsilon:.02,maxLagSpread:.25});
  assert.strictEqual(s.status,'LAG_SENSITIVE');
}

// Too-short/rank-deficient local comparisons return no numeric claim.
{
  const aVals=[10,11,9],bVals=[12,13,11];
  const a=regime('R1','2026-08-01',aVals),b=regime('R2','2026-08-04',bVals);
  const out=T.evaluateTemporalTransition(transition(),a,b,metrics('R1',aVals),metrics('R2',bVals),{lags:[0,1,2]});
  assert.strictEqual(out.status,'LAG_NOT_IDENTIFIED');
  assert.ok(out.lagResults.every(x=>x.status!=='IDENTIFIED'));
}

console.log('PASS temporal adjustment contracts');
