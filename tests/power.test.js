const assert = require('assert');
const M=require('../src/regime_metrics.js');
const W=require('../src/power.js');
const E=require('../src/economics.js');

function metric(mean, variance){
  return {primaryMode:'orders',primaryMean:mean,primaryVariance:variance,primaryKpiName:'orders/day',primaryDaily:Array(14).fill(mean)};
}

{
  const f=W.estimateTestFeasibility(metric(.2,.2),.20,{maxTestDays:28,alpha:.05,power:.80});
  assert.strictEqual(f.feasible,false);
  assert.strictEqual(f.status,'NO_FEASIBLE_TEST');
  assert.ok(f.requiredDays>28);
}

{
  const f=W.estimateTestFeasibility(metric(100,100),.20,{maxTestDays:28,alpha:.05,power:.80});
  assert.strictEqual(f.feasible,true);
  assert.ok(f.requiredDays<=28);
  assert.ok(f.requiredPrimaryKpi>0);
}

{
  const row={safeOrderUnits:10,totalRevenue:5000,spend:1000};
  assert.strictEqual(E.contributionProfit(row,{}),null);
  assert.strictEqual(E.contributionProfit(row,{unitContributionBeforeAds:300}),2000);
  assert.strictEqual(E.contributionProfit(row,{contributionMarginRate:.5}),1500);
}

{
  const days=Array.from({length:7},(_,i)=>({
    date:`2026-07-${String(i+1).padStart(2,'0')}`,clicks:100,carts:20,spend:1400,totalRevenue:5000,
    safeOrderUnits:10,safeOrderReliable:true
  }));
  const regime={id:'R1',startDate:days[0].date,endDate:days.at(-1).date,days,nDays:7,cpcMedian:14};
  const m=M.aggregateRegimeMetrics(regime,days,{});
  assert.strictEqual(m.primaryMode,'orders');
  assert.strictEqual(m.isProfitObjective,false);
  assert.strictEqual(m.primaryMean,10);
}

console.log('PASS regime metrics, economics and power contracts');
