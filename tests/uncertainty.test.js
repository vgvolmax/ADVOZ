const assert=require('assert');
const U=require('../src/uncertainty.js');

function iso(start,offset){const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)}
function makeRegime(id,start,n,step=0){
  const days=[];
  for(let i=0;i<n;i++){
    const date=iso(start,i),wd=new Date(date+'T00:00:00Z').getUTCDay();
    const weekdayEffect=[0,-1,0,1,0,1,-1][wd];
    const serial=[-1.2,-0.4,0.3,0.8,1.0,0.4,-0.6,-1.0][i%8];
    days.push({date,safeOrderReliable:true,safeOrderUnits:20+weekdayEffect+serial+step});
  }
  return {id,startDate:days[0].date,endDate:days.at(-1).date,nDays:n,days};
}
function metrics(id,days){const y=days.map(x=>x.safeOrderUnits),m=y.reduce((s,x)=>s+x,0)/y.length;return{regimeId:id,primaryMode:'orders',primaryKpiName:'orders/day',primaryMean:m}}
function transition(){return{id:'T1',code:'CLEAN_CPC_TRANSITION',evidenceType:'OBSERVATIONAL'}}

// Strong step: deterministic seeded block bootstrap should identify positive uncertainty interval.
{
  const a=makeRegime('R1','2026-05-01',28,0),b=makeRegime('R2','2026-05-29',28,8);
  const temporal={status:'LAG_STABLE',representativeEffectRelative:.40,lagResults:[{lag:0,status:'IDENTIFIED',adjustedEffectRelative:.40},{lag:1,status:'IDENTIFIED',adjustedEffectRelative:.41},{lag:2,status:'IDENTIFIED',adjustedEffectRelative:.39}]};
  const opt={reps:300,seed:12345,alpha:.05,blockSize:4};
  const x=U.estimateTemporalUncertainty(transition(),temporal,a,b,metrics('R1',a.days),metrics('R2',b.days),opt);
  const y=U.estimateTemporalUncertainty(transition(),temporal,a,b,metrics('R1',a.days),metrics('R2',b.days),opt);
  assert.strictEqual(x.status,'UNCERTAINTY_IDENTIFIED');
  assert.deepStrictEqual(x,y);
  assert.ok(x.ci.low>0,`expected positive CI, got ${JSON.stringify(x.ci)}`);
  assert.ok(x.pValue<.05,`expected p<.05, got ${x.pValue}`);
  assert.strictEqual(x.method,'MOVING_BLOCK_RESIDUAL_BOOTSTRAP');
}

// No treatment step: bootstrap should not manufacture strong evidence.
{
  const a=makeRegime('R1','2026-07-01',28,0),b=makeRegime('R2','2026-07-29',28,0);
  const temporal={status:'LAG_STABLE',representativeEffectRelative:0,lagResults:[{lag:0,status:'IDENTIFIED',adjustedEffectRelative:0}]};
  const x=U.estimateTemporalUncertainty(transition(),temporal,a,b,metrics('R1',a.days),metrics('R2',b.days),{reps:250,seed:777,blockSize:4});
  assert.strictEqual(x.status,'UNCERTAINTY_IDENTIFIED');
  assert.ok(x.ci.low<=0&&x.ci.high>=0,`zero should be inside CI: ${JSON.stringify(x.ci)}`);
  assert.ok(x.pValue>.10,`null process should not look strong: ${x.pValue}`);
}

// Too-short/rank-deficient local series produces no numeric inferential claim.
{
  const a=makeRegime('R1','2026-08-01',4,0),b=makeRegime('R2','2026-08-05',4,8);
  const temporal={status:'LAG_STABLE',representativeEffectRelative:.4,lagResults:[{lag:0,status:'IDENTIFIED',adjustedEffectRelative:.4}]};
  const x=U.estimateTemporalUncertainty(transition(),temporal,a,b,metrics('R1',a.days),metrics('R2',b.days),{reps:100,seed:1});
  assert.strictEqual(x.status,'UNCERTAINTY_NOT_IDENTIFIED');
  assert.strictEqual(x.pValue,null);
  assert.strictEqual(x.ci,null);
}

console.log('PASS block-bootstrap uncertainty contracts');
