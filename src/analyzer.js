(function(root,factory){
  const deps=typeof module==='object'&&module.exports?{
    N:require('./normalize.js'),O:require('./order_model.js'),C:require('./cpc_regimes.js'),B:require('./budget_regimes.js'),P:require('./price_regimes.js'),T:require('./transitions.js'),M:require('./regime_metrics.js'),R:require('./response_curve.js'),TP:require('./test_planner.js'),V:require('./transition_evaluator.js'),MT:require('./multiple_testing.js')
  }:{N:root.OzonV2Normalize,O:root.OzonV2Orders,C:root.OzonV2CpcRegimes,B:root.OzonV2BudgetRegimes,P:root.OzonV2PriceRegimes,T:root.OzonV2Transitions,M:root.OzonV2RegimeMetrics,R:root.OzonV2ResponseCurve,TP:root.OzonV2TestPlanner,V:root.OzonV2TransitionEvaluator,MT:root.OzonV2MultipleTesting};
  const api=factory(deps);
  if(typeof module==='object'&&module.exports) module.exports=api; else root.OzonV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(D){
'use strict';
for(const [k,v] of Object.entries(D)) if(!v) throw new Error(`Missing v2 dependency ${k}`);
function groupRows(rows,todayIso){
  const by=new Map();
  for(const r of rows||[]){
    if(!r?.sku||!r?.date||r.date===todayIso)continue;
    if(!by.has(r.sku))by.set(r.sku,new Map());
    const m=by.get(r.sku),key=String(r.date),old=m.get(key);
    if(!old||(Number(r.sourceOrder)||0)>=(Number(old.sourceOrder)||0))m.set(key,r);
  }
  return [...by].map(([sku,m])=>({sku,days:[...m.values()].sort((a,b)=>a.date.localeCompare(b.date))}));
}
function isValidatedTransition(t,metricsByRegime){
  const a=metricsByRegime?.get(t?.fromRegimeId),b=metricsByRegime?.get(t?.toRegimeId),effect=Number(t?.effectRelative),ci=t?.uncertainty?.ci;
  if(t?.code!=='CLEAN_CPC_TRANSITION'||!a||!b)return false;
  if(a.primaryMode!==b.primaryMode||a.primaryUsable!==true||b.primaryUsable!==true)return false;
  if(t?.temporal?.status!=='LAG_STABLE'||t?.uncertainty?.status!=='UNCERTAINTY_IDENTIFIED'||t?.fdrStatus!=='FDR_PASS')return false;
  if(!Number.isFinite(effect)||!Number.isFinite(ci?.low)||!Number.isFinite(ci?.high))return false;
  return effect>0?ci.low>0:effect<0?ci.high<0:false;
}
function transitionDirection(t){
  const cpcChange=Number(t?.cpcChange),effect=Number(t?.effectRelative);
  if(!Number.isFinite(cpcChange)||!Number.isFinite(effect)||cpcChange===0||effect===0)return null;
  const higherCpcWasBetter=(cpcChange>0&&effect>0)||(cpcChange<0&&effect<0);
  return higherCpcWasBetter?'UP':'DOWN';
}
function validatedTransitions(analysis){
  const by=new Map((analysis?.regimeMetrics||[]).map(x=>[x.regimeId,x]));
  return (analysis?.transitions||[]).filter(t=>isValidatedTransition(t,by));
}
function buildValidatedResponseEvidence(analysis){
  const valid=validatedTransitions(analysis),support=new Map();
  for(const t of valid)for(const id of [t.fromRegimeId,t.toRegimeId]){if(!support.has(id))support.set(id,[]);support.get(id).push(t.id)}
  return (analysis?.regimeMetrics||[]).filter(m=>support.has(m.regimeId)&&m.primaryUsable===true).map(m=>({cpc:m.cpc,primaryMean:m.primaryMean,nDays:m.nDays,usable:true,regimeId:m.regimeId,evidenceType:'OBSERVATIONAL',validationStatus:'VALIDATED',supportingTransitionIds:support.get(m.regimeId)}));
}
function validatedDirection(analysis){
  const dirs=[...new Set(validatedTransitions(analysis).map(transitionDirection).filter(Boolean))];
  return dirs.length===1?dirs[0]:null;
}
function noRecommendation(reasonCode,reason){return{status:'NO_FEASIBLE_TEST',reasonCode,reason,evidenceType:'OBSERVATIONAL'}}
function finalizeSkuAfterFdr(analysis,settings={}){
  const evidence=buildValidatedResponseEvidence(analysis),curve=D.R.buildResponseCurve(evidence,settings.response||{}),baselineMetrics=analysis?.regimeMetrics?.at(-1)||null,direction=validatedDirection(analysis);
  let recommendation;
  if(!baselineMetrics)recommendation=noRecommendation('NO_BASELINE_CPC','Нет устойчивого baseline regime.');
  else if(baselineMetrics.primaryUsable!==true)recommendation=noRecommendation('PRIMARY_KPI_LOW_COVERAGE','Последний устойчивый режим не имеет достаточного покрытия выбранного primary KPI.');
  else if(!direction)recommendation=noRecommendation('NO_VALIDATED_DIRECTION','Нет post-FDR validated observational evidence с однозначным направлением CPC.');
  else recommendation=D.TP.planNextTest({baselineMetrics,cpcNoise:analysis.cpcNoise,responseCurve:curve,direction},{...(settings.power||{}),...(settings.planner||{})});
  return {...analysis,responseEvidence:evidence,validatedDirection:direction,responseCurve:{status:curve.status,points:curve.points,minCpc:curve.minCpc,maxCpc:curve.maxCpc,bestPoint:curve.bestPoint},recommendation};
}
function analyzeSkuPreFdr(sku,days,settings={}){
  const safe=D.O.buildSafeOrderSeries(days,settings.orders||{}),primaryObjective=D.M.resolvePrimaryObjective(safe,settings.economics||{}),cpc=D.C.detectCpcRegimes(safe,settings.cpc||{}),budget=D.B.inferEffectiveBudgetStates(safe,cpc.regimes,settings.budget||{}),price=D.P.detectPriceRegimes(safe,settings.price||{}),metrics=cpc.regimes.map(r=>D.M.aggregateRegimeMetrics(r,safe,settings.economics||{},primaryObjective));
  let transitions=D.T.buildTransitions(cpc.regimes,budget,price,settings.transitions||{});
  transitions=D.V.evaluateTransitions(transitions,metrics,{...(settings.power||{}),...(settings.evaluator||{}),regimes:cpc.regimes,economicsSettings:settings.economics||{},temporal:settings.temporal||{},uncertainty:settings.uncertainty||{}});
  const accounting=safe.map(r=>D.N.validateAccounting(r,settings.accountingTolerance??.05));
  return {sku,name:safe.find(r=>r.name)?.name||'',days:safe,primaryObjective,cpcRegimes:cpc.regimes,cpcNoise:cpc.noise,cpcChangePoints:cpc.changePoints,budgetStates:budget.states,budgetChangePoints:budget.changePoints,rolling7d:budget.rolling,priceRegimes:price.regimes,priceStatus:price.status,priceCoverage:price.coverage,regimeMetrics:metrics,transitions,currentRegime:cpc.regimes.at(-1)||null,evidenceType:'OBSERVATIONAL',dataQuality:{accountingMismatchCount:accounting.filter(x=>x.code==='ACCOUNTING_MISMATCH').length,accountingCheckableCount:accounting.filter(x=>x.code!=='ACCOUNTING_NOT_CHECKABLE').length,orderReliableCoverage:safe.length?safe.filter(x=>x.safeOrderReliable).length/safe.length:0}};
}
function analyzeSku(sku,days,settings={}){const pre=analyzeSkuPreFdr(sku,days,settings),[adjusted]=D.MT.applyFdrToCampaign([pre],{alpha:Number(settings.fdrAlpha)||.05});return finalizeSkuAfterFdr(adjusted,settings)}
function analyzeCampaignV2(rows,settings={}){const pre=groupRows(rows,settings.todayIso).map(g=>analyzeSkuPreFdr(g.sku,g.days,settings)),adjusted=D.MT.applyFdrToCampaign(pre,{alpha:Number(settings.fdrAlpha)||.05});return adjusted.map(a=>finalizeSkuAfterFdr(a,settings))}
return {analyzeCampaignV2,_internals:{groupRows,analyzeSku,analyzeSkuPreFdr,finalizeSkuAfterFdr,isValidatedTransition,buildValidatedResponseEvidence,validatedDirection,transitionDirection}};
});
