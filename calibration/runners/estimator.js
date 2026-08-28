'use strict';
const {createRng}=require('../rng.js');
const {generateOzonHistory}=require('../dgp/ozon_history.js');
const T=require('../../src/temporal_adjustment.js');
const U=require('../../src/uncertainty.js');
const M=require('../../src/regime_metrics.js');

function knownRegimes(rows,truth){
  return truth.cpcRegimes.map((r,i)=>({id:`R${i+1}`,startDate:r.startDate,endDate:r.endDate,cpc:r.cpc,cpcMedian:r.cpc,days:rows.filter(x=>x.date>=r.startDate&&x.date<=r.endDate)}));
}
function makeEstimatorRows(rows){return rows.map(r=>({...r,safeOrderReliable:true,safeOrderUnits:Number(r.modelUnits)||0,safeOrderSource:'calibration-observed-model-units'}))}
function runEstimatorReplication(scenario,seed,productionSettings={}){
  const parameters=scenario?.parameters||scenario||{},scenarioId=String(scenario?.id||parameters.id||'A');
  const generated=generateOzonHistory({...parameters,id:scenarioId},createRng(seed)),rows=makeEstimatorRows(generated.rows),regimes=knownRegimes(rows,generated.truth);
  if(regimes.length<2)return{scenarioId,seed,trueEffect:generated.truth.trueEffect,trueLag:generated.truth.trueLag,identified:false,lagStatus:'LAG_NOT_IDENTIFIED',effectEstimate:null,ci:null,ciCovered:false,ciWidth:null,pValue:null,signRecovered:false,strongFalsePositive:false,reason:'LESS_THAN_TWO_TRUE_REGIMES'};
  const objective={mode:'orders',name:'orders/day',minCoverage:0},metrics=regimes.map(r=>M.aggregateRegimeMetrics(r,rows,{minOrderCoverage:0},objective));
  const from=regimes[0],to=regimes[1],a=metrics[0],b=metrics[1],transition={id:'T1',fromRegimeId:from.id,toRegimeId:to.id,fromCpc:from.cpc,toCpc:to.cpc,cpcChange:to.cpc/from.cpc-1,code:'CLEAN_CPC_TRANSITION',evidenceType:'OBSERVATIONAL'};
  const temporal=T.evaluateTemporalTransition(transition,from,to,a,b,{...(productionSettings.temporal||{}),economicsSettings:{}}),uncertainty=temporal.status==='LAG_STABLE'?U.estimateTemporalUncertainty(transition,temporal,from,to,a,b,{...(productionSettings.uncertainty||{}),economicsSettings:{}}):{status:'UNCERTAINTY_NOT_IDENTIFIED',ci:null,pValue:null};
  const identified=temporal.status==='LAG_STABLE'&&uncertainty.status==='UNCERTAINTY_IDENTIFIED',effectEstimate=identified?temporal.representativeEffectRelative:null,ci=identified?uncertainty.ci:null,trueEffect=Number(generated.truth.trueEffect)||0;
  const ciCovered=!!(identified&&Number.isFinite(ci?.low)&&Number.isFinite(ci?.high)&&trueEffect>=ci.low&&trueEffect<=ci.high),ciWidth=identified?ci.high-ci.low:null;
  const signRecovered=Math.abs(trueEffect)<1e-12?null:!!(identified&&Math.sign(effectEstimate)===Math.sign(trueEffect));
  const strongFalsePositive=Math.abs(trueEffect)<1e-12&&identified&&(ci.low>0||ci.high<0);
  return{scenarioId,seed,trueEffect,trueLag:generated.truth.trueLag,identified,lagStatus:temporal.status,effectEstimate,ci,ciCovered,ciWidth,pValue:identified?uncertainty.pValue:null,signRecovered,strongFalsePositive,temporalStatus:temporal.status,uncertaintyStatus:uncertainty.status,identifiedLags:temporal.identifiedLags||[],basis:'OBSERVATIONAL'};
}
module.exports={runEstimatorReplication,_internals:{knownRegimes,makeEstimatorRows}};
