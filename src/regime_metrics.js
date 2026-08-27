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
function aggregateRegimeMetrics(regime,days,economicsSettings={}){
  const a=(days||regime?.days||[]).filter(r=>r.date>=regime.startDate&&r.date<=regime.endDate).slice().sort((x,y)=>x.date.localeCompare(y.date));
  const clicks=a.map(r=>Number(r.clicks)||0),carts=a.map(r=>Number(r.carts)||0),spend=a.map(r=>Number(r.spend)).filter(Number.isFinite),revenue=a.map(r=>Number(r.totalRevenue)||0);
  const orderDaily=a.map(r=>r.safeOrderReliable&&Number.isFinite(Number(r.safeOrderUnits))?Number(r.safeOrderUnits):(r.orderReliable&&Number.isFinite(Number(r.orderUnitsEstimate))?Number(r.orderUnitsEstimate):null));
  const reliableOrders=orderDaily.filter(Number.isFinite),profitDaily=a.map(r=>E.contributionProfit(r,economicsSettings)),profits=profitDaily.filter(Number.isFinite);
  const minProfitCoverage=Number.isFinite(Number(economicsSettings.minProfitCoverage))?Number(economicsSettings.minProfitCoverage):.70;
  const useProfit=a.length>0&&profits.length/a.length>=minProfitCoverage;
  const primaryDaily=useProfit?profits:reliableOrders;
  const wd=Array(7).fill(0);for(const r of a)wd[weekday(r.date)]++;
  return {
    regimeId:regime.id,startDate:regime.startDate,endDate:regime.endDate,nDays:a.length,
    cpc:regime.cpc??regime.cpcMedian,
    clicks:a.reduce((s,r)=>s+(Number(r.clicks)||0),0),carts:a.reduce((s,r)=>s+(Number(r.carts)||0),0),
    orders:reliableOrders.reduce((s,x)=>s+x,0),revenue:revenue.reduce((s,x)=>s+x,0),spend:spend.reduce((s,x)=>s+x,0),
    clicksPerDay:mean(clicks),cartsPerDay:mean(carts),ordersPerDay:mean(reliableOrders),revenuePerDay:mean(revenue),spendPerDay:mean(spend),
    orderCoverage:a.length?reliableOrders.length/a.length:0,profitCoverage:a.length?profits.length/a.length:0,
    contributionProfitPerDay:profits.length?mean(profits):null,
    primaryMode:useProfit?'profit':'orders',isProfitObjective:useProfit,primaryKpiName:useProfit?'contributionProfit/day':'orders/day',
    primaryDaily,primaryMean:mean(primaryDaily),primaryVariance:variance(primaryDaily),weekdayComposition:wd
  };
}
return {aggregateRegimeMetrics,_internals:{mean,variance}};
});
