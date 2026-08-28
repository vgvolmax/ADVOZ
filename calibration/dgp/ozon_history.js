'use strict';
const {samplePoisson,sampleGammaPoisson}=require('./counts.js');
const {generateLatentSeries}=require('./time_series.js');
const {freezeTruth}=require('../schema.js');

function isoDate(startDate,index){const d=new Date(`${startDate}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+index);return d.toISOString().slice(0,10)}
function atIndex(regimes,t){return (regimes||[]).find(r=>t>=Number(r.start)&&t<=Number(r.end))||null}
function valueAt(regimes,t,key,fallback){const r=atIndex(regimes,t);return r&&Number.isFinite(Number(r[key]))?Number(r[key]):fallback}
function structuralElasticity(config,regimes){
  if(Number.isFinite(Number(config.cpcElasticity)))return Number(config.cpcElasticity);
  const effect=Number(config.trueEffect);if(!Number.isFinite(effect)||effect<=-1)return 0;
  const base=Number(regimes?.[0]?.cpc),other=(regimes||[]).find(r=>Number(r.cpc)>0&&Math.abs(Number(r.cpc)/base-1)>1e-9);
  if(!(base>0&&other&&Number(other.cpc)>0)||Math.abs(effect)<1e-15)return 0;
  return Math.log1p(effect)/Math.log(Number(other.cpc)/base);
}
function outcomeMultiplier(config,regimes,t){
  const lag=Math.max(0,Math.round(Number(config.trueLag)||0)),effective=Math.max(0,t-lag),r=atIndex(regimes,effective);
  if(r&&Number.isFinite(Number(r.outcomeMultiplier)))return Number(r.outcomeMultiplier);
  const base=Number(regimes?.[0]?.cpc),cpc=Number(r?.cpc??base),e=structuralElasticity(config,regimes);
  return base>0&&cpc>0?Math.pow(cpc/base,e):1;
}
function priceAt(config,t){return valueAt(config.priceRegimes,t,'price',Math.max(.01,Number(config.basePrice)||500))}
function budgetCapAt(config,t){return valueAt(config.weeklyBudgetCaps,t,'cap',null)}
function structuralDemandMultiplier(config,t){
  const s=config.demandShock;if(!s)return 1;
  const start=Math.max(0,Math.round(Number(s.start)||0)),end=Number.isFinite(Number(s.end))?Math.round(Number(s.end)):Infinity;
  return t>=start&&t<=end?Math.max(.01,Number(s.multiplier)||1):1;
}
function generateOzonHistory(config={},rng){
  if(!rng||typeof rng.uniform!=='function')throw new TypeError('seeded rng is required');
  const days=Math.max(1,Math.round(Number(config.days)||90)),startDate=config.startDate||'2026-06-01',sku=String(config.sku||'SIM-1'),campaignId=String(config.campaignId||'SIM-CAMPAIGN');
  const regimes=(config.cpcRegimes||[{start:0,end:days-1,cpc:14}]).map(r=>({...r,start:Math.max(0,Math.round(Number(r.start)||0)),end:Math.min(days-1,Math.round(Number(r.end))),cpc:Number(r.cpc)}));
  const baseDemand=Math.max(1e-9,Number(config.baseDemand)||1),latent=generateLatentSeries({...config,days,baseDemand},rng.fork('latent'));
  const cpcRng=rng.fork('cpc'),clickRng=rng.fork('clicks'),orderRng=rng.fork('orders'),missingRng=rng.fork('missing'),coverageRng=rng.fork('coverage');
  const baseCpc=Number(regimes[0]?.cpc)||14,cpcNoiseSigma=Math.max(0,Number(config.cpcNoiseSigma)||0),clickBaseMean=Math.max(1,Number(config.clickBaseMean)||200),trafficElasticity=Number(config.cpcTrafficElasticity)||0;
  const orderBaseMean=Math.max(.01,Number(config.orderBaseMean)||20),overdispersion=Math.max(0,Number(config.orderOverdispersion)||0),missingSpendRate=Math.max(0,Math.min(1,Number(config.missingSpendRate)||0)),orderCoverageRate=Math.max(0,Math.min(1,Number.isFinite(Number(config.orderCoverageRate))?Number(config.orderCoverageRate):1));
  const gapSet=new Set((config.gapIndices||[]).map(Number)),weeklyWeights=[.75,.9,1.05,1.15,1.2,1.05,.9],rows=[];
  const changePointIndices=[];for(let i=1;i<regimes.length;i++)changePointIndices.push(regimes[i].start);
  const outliers=config.cpcOutliers||{};
  for(let t=0;t<days;t++){
    if(gapSet.has(t))continue;
    const regime=atIndex(regimes,t);if(!regime)continue;
    let achieved=regime.cpc*Math.exp(cpcNoiseSigma*cpcRng.normal());
    const outlier=Number(outliers[t]);if(Number.isFinite(outlier)&&outlier>0)achieved*=outlier;
    const demandFactor=(latent.demand[t]/baseDemand)*structuralDemandMultiplier(config,t),trafficFactor=Math.pow(Math.max(achieved,1e-9)/baseCpc,trafficElasticity);
    const cap=budgetCapAt(config,t);let clicks;
    if(cap>0){const targetSpend=(cap/7)*weeklyWeights[t%7];clicks=Math.max(1,Math.round(targetSpend/Math.max(achieved,1e-9)))}
    else clicks=Math.max(1,samplePoisson(clickBaseMean*demandFactor*trafficFactor,clickRng));
    const spendObserved=missingRng.uniform()>=missingSpendRate;
    const spend=spendObserved?achieved*clicks:null;
    const effect=outcomeMultiplier(config,regimes,t),orderMean=Math.max(0,orderBaseMean*demandFactor*effect),orders=sampleGammaPoisson(orderMean,overdispersion,orderRng);
    const price=priceAt(config,t),direct=orders===0||coverageRng.uniform()<orderCoverageRate;
    const promotedUnits=orders>0&&direct?orders:0,promotedRevenue=orders>0&&direct?orders*price:0,totalRevenue=orders*price;
    const carts=Math.max(orders,orders+samplePoisson(Math.max(1,orders*.6),orderRng));
    rows.push({campaignId,sku,name:String(config.name||sku),date:isoDate(startDate,t),impressions:Math.max(clicks,Math.round(clicks/(Number(config.ctr)||.08))),clicks,carts,reportedCpc:achieved,spend,promotedUnits,promotedRevenue,modelUnits:orders,modelRevenue:orders*price,totalRevenue,currentPrice:price,sourceOrder:1});
  }
  const elasticity=structuralElasticity(config,regimes),truth=freezeTruth({
    scenarioId:String(config.id||'unnamed'),days,startDate,sku,campaignId,trueEffect:Number.isFinite(Number(config.trueEffect))?Number(config.trueEffect):null,trueLag:Math.max(0,Math.round(Number(config.trueLag)||0)),cpcElasticity:elasticity,
    cpcRegimes:regimes.map(r=>({...r,startDate:isoDate(startDate,r.start),endDate:isoDate(startDate,r.end)})),changePointIndices,changePointDates:changePointIndices.map(i=>isoDate(startDate,i)),gapIndices:[...gapSet].sort((a,b)=>a-b),
    nullEffect:Math.abs(elasticity)<1e-12,structurallyClean:!(config.demandShock||config.priceRegimes?.length>1||config.weeklyBudgetCaps?.length>1||gapSet.size),confounders:{demandShock:!!config.demandShock,priceChange:(config.priceRegimes?.length||0)>1,budgetChange:(config.weeklyBudgetCaps?.length||0)>1,dataGap:gapSet.size>0},
    expectedNextDirection:config.expectedNextDirection||null
  });
  return{rows,truth,latent};
}
module.exports={generateOzonHistory,_internals:{isoDate,atIndex,valueAt,structuralElasticity,outcomeMultiplier,priceAt,budgetCapAt,structuralDemandMultiplier}};
