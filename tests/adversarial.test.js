const assert=require('assert');
const A=require('../src/analyzer.js');
function iso(start,offset){const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)}
function row(i,cpc,orders,spend=null,reportedCpc=cpc){
  const clicks=spend==null?100:spend/cpc,actualSpend=spend==null?cpc*clicks:spend,price=500;
  return {campaignId:'C1',sku:'S1',date:iso('2026-05-01',i),clicks,carts:orders*2,spend:actualSpend,reportedCpc,promotedUnits:2,promotedRevenue:1000,totalRevenue:orders*price,currentPrice:price};
}

{
  // Demand shock without a CPC regime change must not create a CPC transition.
  const rows=[];for(let i=0;i<30;i++)rows.push(row(i,14,i<15?20:60));
  const [x]=A.analyzeCampaignV2(rows,{budget:{minRollingPoints:5}});
  assert.strictEqual(x.cpcRegimes.length,1);
  assert.strictEqual(x.transitions.length,0);
  assert.strictEqual(x.recommendation.status,'NO_FEASIBLE_TEST');
}

{
  // CPC changes while rolling spend also shows a structural level shift. Without a direct budget observation,
  // v2 must not guess that the budget cap changed: the transition stays observationally uncertain.
  const rows=[];
  for(let i=0;i<14;i++)rows.push(row(i,14,80,1000));
  for(let i=14;i<42;i++)rows.push(row(i,16,100,i<28?1600:3200));
  const [x]=A.analyzeCampaignV2(rows,{budget:{minRollingPoints:5,plateauCv:.05,capChangeRelative:.2}});
  assert.strictEqual(x.cpcRegimes.length,2);
  assert.strictEqual(x.budgetStates.at(-1).code,'BUDGET_STATE_UNCERTAIN');
  assert.strictEqual(x.budgetStates.at(-1).structuralShiftObserved,true);
  assert.strictEqual(x.transitions[0].code,'TRANSITION_UNCERTAIN');
  assert.strictEqual(x.transitions[0].decision,'INCONCLUSIVE');
  assert.strictEqual(x.transitions[0].evidenceType,'OBSERVATIONAL');
}

{
  // Reported CPC can disagree with Spend/Clicks; it is a data-quality warning, not a budget signal.
  const rows=[];for(let i=0;i<28;i++)rows.push(row(i,10,50,1000,i<14?10:20));
  const [x]=A.analyzeCampaignV2(rows,{budget:{minRollingPoints:5}});
  assert.strictEqual(x.cpcRegimes.length,1);
  assert.ok(x.dataQuality.accountingMismatchCount>=14);
  assert.strictEqual(x.transitions.length,0);
}

console.log('PASS adversarial system contracts');
