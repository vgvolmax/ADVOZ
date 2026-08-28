const assert=require('assert');
const V=require('../src/transition_evaluator.js');

function iso(start,offset){const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)}
function regime(id,start,n,step=0){const days=[];for(let i=0;i<n;i++){const date=iso(start,i),wd=new Date(date+'T00:00:00Z').getUTCDay(),noise=[-1,-.4,.2,.8,.5,-.2,-.8][i%7];days.push({date,safeOrderReliable:true,safeOrderUnits:20+(wd===0?1:0)+noise+step})}return{id,startDate:days[0].date,endDate:days.at(-1).date,nDays:n,days,cpc: id==='R1'?10:12}}
function metric(r){const ys=r.days.map(x=>x.safeOrderUnits),m=ys.reduce((s,x)=>s+x,0)/ys.length,v=ys.reduce((s,x)=>s+(x-m)**2,0)/(ys.length-1);return{regimeId:r.id,nDays:r.nDays,primaryMode:'orders',primaryKpiName:'orders/day',primaryMean:m,primaryVariance:v,orders:r.days.reduce((s,x)=>s+x.safeOrderUnits,0)}}
const t={id:'T1',code:'CLEAN_CPC_TRANSITION',evidenceType:'OBSERVATIONAL',fromRegimeId:'R1',toRegimeId:'R2',fromCpc:10,toCpc:12};

{
 const a=regime('R1','2026-03-01',28,0),b=regime('R2','2026-03-29',28,8),metrics=[metric(a),metric(b)];
 const out=V.evaluateTransitions([t],metrics,{regimes:[a,b],mdeRelative:.20,maxTestDays:90,temporal:{lags:[0,1,2]},uncertainty:{reps:250,seed:123,blockSize:4}})[0];
 assert.strictEqual(out.uncertainty.status,'UNCERTAINTY_IDENTIFIED');
 assert.ok(out.uncertainty.ci.low>0);
 assert.strictEqual(out.decision,'DEPLOY');
 assert.strictEqual(out.effectSource,'TEMPORAL_ADJUSTED');
}

{
 const a=regime('R1','2026-06-01',28,0),b=regime('R2','2026-06-29',28,0),metrics=[metric(a),metric(b)];
 const out=V.evaluateTransitions([t],metrics,{regimes:[a,b],mdeRelative:.10,maxTestDays:90,temporal:{lags:[0,1,2]},uncertainty:{reps:250,seed:456,blockSize:4}})[0];
 assert.strictEqual(out.uncertainty.status,'UNCERTAINTY_IDENTIFIED');
 assert.ok(out.uncertainty.ci.low<=0&&out.uncertainty.ci.high>=0);
 assert.notStrictEqual(out.decision,'DEPLOY');
 assert.notStrictEqual(out.decision,'ROLLBACK');
}

console.log('PASS uncertainty decision integration contracts');
