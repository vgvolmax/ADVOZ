(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./economics.js'):root.OzonV2Economics);
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2RegimeMetrics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E){
'use strict';
if(!E) throw new Error('economics.js must be loaded before regime_metrics.js');
function mean(a){const v=(a||[]).filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null}
function variance(a){const v=(a||[]).filter(Number.isFinite);if(v.length<2)return 0;const m=mean(v);return v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1)}
function weekday(iso){return new Date(iso+'T00:00:00Z').getUTCDay()}
function orderValue(r){
  if(r?.safeOrderReliable&&Number.isFinite(Number(r.safeOrderUnits)))return Number(r.safeOrderUnits);
  if(r?.orderReliable&&Number.isFinite(Number(r.orderUnitsEstimate)))return Number(r.orderUnitsEstimate);
  return null;
}
function resolvePrimaryObjective(days,economicsSettings={}){
  const a=days||[],n=a.length;
  const minOrderCoverage=Number.isFinite(Number(economicsSettings.minOrderCoverage))?Number(economicsSettings.minOrderCoverage):.70;
  const minProfitCoverage=Number.isFinite(Number(economicsSettings.minProfitCoverage))?Number(economicsSettings.minProfitCoverage):.70;
  const profitCount=a.map(r=>E.contributionProfit(r,economicsSettings)).filter(Number.isFinite).length;
  if(n>0&&profitCount/n>=minProfitCoverage)return{mode:'profit',name:'contributionProfit/day',minCoverage:minProfitCoverage};
  return{mode:'orders',name:'orders/day',minCoverage:minOrderCoverage};
}
function aggregateRegimeMetrics(regime,days,economicsSettings={},objective=null){
  const source=days||regime?.days||[],selected=objective||resolvePrimaryObjective(source,economicsSettings);
  const a=source.filter(r=>r.date>=regime.startDate&&r.date<=regime.endDate).slice().sort((x,y)=>x.date.localeCompare(y.date));
  const clicks=a.map(r=>Number(r.clicks)||0),carts=a.map(r=>Number(r.carts)||0),spend=a.map(r=>Number(r.spend)).filter(Number.isFinite),revenue=a.map(r=>Number(r.totalRevenue)||0);
  const orderDaily=a.map(orderValue),reliableOrders=orderDaily.filter(Number.isFinite),profitDaily=a.map(r=>E.contributionProfit(r,economicsSettings)),profits=profitDaily.filter(Number.isFinite);
  const primaryObserved=selected.mode==='profit'?profits:reliableOrders;
  const primaryCoverage=a.length?primaryObserved.length/a.length:0;
  const primaryMean=mean(primaryObserved),primaryUsable=primaryCoverage>=selected.minCoverage&&Number.isFinite(primaryMean);
  const wd=Array(7).fill(0);for(const r of a)wd[weekday(r.date)]++;
  return {
    regimeId:regime.id,startDate:regime.startDate,endDate:regime.endDate,nDays:a.length,
    cpc:regime.cpc??regime.cpcMedian,
    clicks:a.reduce((s,r)=>s+(Number(r.clicks)||0),0),carts:a.reduce((s,r)=>s+(Number(r.carts)||0),0),
    orders:reliableOrders.reduce((s,x)=>s+x,0),revenue:revenue.reduce((s,x)=>s+x,0),spend:spend.reduce((s,x)=>s+x,0),
    clicksPerDay:mean(clicks),cartsPerDay:mean(carts),ordersPerDay:mean(reliableOrders),revenuePerDay:mean(revenue),spendPerDay:mean(spend),
    orderCoverage:a.length?reliableOrders.length/a.length:0,profitCoverage:a.length?profits.length/a.length:0,
    contributionProfitPerDay:profits.length?mean(profits):null,
    primaryMode:selected.mode,isProfitObjective:selected.mode==='profit',primaryKpiName:selected.name,primaryCoverage,primaryUsable,
    primaryDaily:primaryObserved,primaryMean,primaryVariance:variance(primaryObserved),weekdayComposition:wd
  };
}
return {resolvePrimaryObjective,aggregateRegimeMetrics,_internals:{mean,variance,orderValue}};
});
