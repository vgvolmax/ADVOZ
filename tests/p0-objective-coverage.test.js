'use strict';
const assert=require('assert');
const M=require('../src/regime_metrics.js');

function day(date,ordersReliable,orders,extra={}){
  return {date,safeOrderReliable:ordersReliable,safeOrderUnits:orders,totalRevenue:1000,spend:100,...extra};
}

{
  const days=[
    day('2026-06-01',true,2),
    day('2026-06-02',true,3),
    day('2026-06-03',false,null)
  ];
  const objective=M.resolvePrimaryObjective(days,{minOrderCoverage:.70});
  assert.equal(objective.mode,'orders');
  assert.equal(objective.name,'orders/day');
  const regime={id:'R1',startDate:'2026-06-01',endDate:'2026-06-03',cpc:14};
  const metric=M.aggregateRegimeMetrics(regime,days,{minOrderCoverage:.70},objective);
  assert.equal(metric.primaryMode,'orders');
  assert.equal(metric.primaryKpiName,'orders/day');
  assert.ok(metric.primaryCoverage<.70);
  assert.equal(metric.primaryUsable,false);
}

{
  const days=[
    day('2026-06-01',true,2),day('2026-06-02',true,3),day('2026-06-03',true,4),day('2026-06-04',true,5)
  ];
  const objective=M.resolvePrimaryObjective(days,{minOrderCoverage:.70});
  assert.equal(objective.mode,'orders');
  const short=[days[0],days[1],{...days[2],safeOrderReliable:false,safeOrderUnits:null}];
  const metric=M.aggregateRegimeMetrics({id:'R2',startDate:'2026-06-01',endDate:'2026-06-03',cpc:16},short,{minOrderCoverage:.70},objective);
  assert.equal(metric.primaryMode,'orders');
  assert.equal(metric.primaryUsable,false);
}

console.log('PASS primary objective lock and coverage contracts');
