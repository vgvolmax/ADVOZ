(function(root,factory){
  const deps=typeof module==='object'&&module.exports?{
    N:require('./normalize.js'),O:require('./order_model.js'),C:require('./cpc_regimes.js'),B:require('./budget_regimes.js'),P:require('./price_regimes.js'),T:require('./transitions.js'),M:require('./regime_metrics.js'),R:require('./response_curve.js'),TP:require('./test_planner.js'),V:require('./transition_evaluator.js')
  }:{N:root.OzonV2Normalize,O:root.OzonV2Orders,C:root.OzonV2CpcRegimes,B:root.OzonV2BudgetRegimes,P:root.OzonV2PriceRegimes,T:root.OzonV2Transitions,M:root.OzonV2RegimeMetrics,R:root.OzonV2ResponseCurve,TP:root.OzonV2TestPlanner,V:root.OzonV2TransitionEvaluator};
  const api=factory(deps);
  if(typeof module==='object'&&module.exports) module.exports=api; else root.OzonV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(D){
'use strict';
for(const [k,v] of Object.entries(D)) if(!v) throw new Error(`Missing v2 dependency ${k}`);
function groupRows(rows,todayIso){
  const by=new Map();
  for(const r of rows||[]){if(!r?.sku||!r?.date||r.date===todayIso)continue;if(!by.has(r.sku))by.set(r.sku,new Map());const m=by.get(r.sku),old=m.get(r.date);if(!old||(Number(r.sourceOrder)||0)>=(Number(old.sourceOrder)||0))m.set(r.date,r)}
  return [...by].map(([sku,m])=>({sku,days:[...m.values()].sort((a,b)=>a.date.localeCompare(b.date))}));
}
function analyzeSku(sku,days,settings={}){
  const safe=D.O.buildSafeOrderSeries(days,settings.orders||{});
  const cpc=D.C.detectCpcRegimes(safe,settings.cpc||{});
  const budget=D.B.inferEffectiveBudgetStates(safe,cpc.regimes,settings.budget||{});
  const price=D.P.detectPriceRegimes(safe,settings.price||{});
  const metrics=cpc.regimes.map(r=>D.M.aggregateRegimeMetrics(r,safe,settings.economics||{}));
  let transitions=D.T.buildTransitions(cpc.regimes,budget,price,settings.transitions||{});
  transitions=D.V.evaluateTransitions(transitions,metrics,{...(settings.power||{}),...(settings.evaluator||{})});
  const cleanIds=new Set();for(const t of transitions)if(t.code==='CLEAN_CPC_TRANSITION'){cleanIds.add(t.fromRegimeId);cleanIds.add(t.toRegimeId)}
  const evidence=metrics.map(m=>({cpc:m.cpc,primaryMean:m.primaryMean,nDays:m.nDays,usable:cleanIds.has(m.regimeId),regimeId:m.regimeId,evidenceType:'OBSERVATIONAL'}));
  const curve=D.R.buildResponseCurve(evidence,settings.response||{}),baselineMetrics=metrics.at(-1)||null;
  const recommendation=baselineMetrics?D.TP.planNextTest({baselineMetrics,cpcNoise:cpc.noise,responseCurve:curve},{...(settings.power||{}),...(settings.planner||{})}):{status:'NO_FEASIBLE_TEST',reasonCode:'NO_BASELINE_CPC',reason:'Нет устойчивого baseline regime.',evidenceType:'OBSERVATIONAL'};
  const accounting=safe.map(r=>D.N.validateAccounting(r,settings.accountingTolerance??.05));
  return {
    sku,name:safe.find(r=>r.name)?.name||'',days:safe,cpcRegimes:cpc.regimes,cpcNoise:cpc.noise,cpcChangePoints:cpc.changePoints,
    budgetStates:budget.states,budgetChangePoints:budget.changePoints,rolling7d:budget.rolling,priceRegimes:price.regimes,priceStatus:price.status,priceCoverage:price.coverage,
    regimeMetrics:metrics,transitions,responseCurve:{status:curve.status,points:curve.points,minCpc:curve.minCpc,maxCpc:curve.maxCpc,bestPoint:curve.bestPoint},recommendation,
    currentRegime:cpc.regimes.at(-1)||null,evidenceType:'OBSERVATIONAL',
    dataQuality:{accountingMismatchCount:accounting.filter(x=>x.code==='ACCOUNTING_MISMATCH').length,accountingCheckableCount:accounting.filter(x=>x.code!=='ACCOUNTING_NOT_CHECKABLE').length,orderReliableCoverage:safe.length?safe.filter(x=>x.safeOrderReliable).length/safe.length:0}
  };
}
function analyzeCampaignV2(rows,settings={}){return groupRows(rows,settings.todayIso).map(g=>analyzeSku(g.sku,g.days,settings));}
return {analyzeCampaignV2,_internals:{groupRows,analyzeSku}};
});
