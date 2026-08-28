(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2Power=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function normalQuantile(p){
  if(!(p>0&&p<1)) return p===0?-Infinity:p===1?Infinity:NaN;
  const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924];
  const b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857];
  const c=[-.00778489400243029,-.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878];
  const d=[.00778469570904146,.32246712907004,2.445134137143,3.75440866190742];
  const pl=.02425,ph=1-pl;let q,r;
  if(p<pl){q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
  if(p>ph){q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
  q=p-.5;r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}
function varianceFor(metrics){
  const mean=Number(metrics?.primaryMean),raw=Number(metrics?.primaryVariance);
  let variance=Number.isFinite(raw)&&raw>=0?raw:0;
  if(metrics?.primaryMode==='orders'&&mean>0)variance=Math.max(variance,mean);
  if(!(variance>0)&&Number.isFinite(mean))variance=Math.max(Math.abs(mean)*.05,1e-6)**2;
  return variance;
}
function estimateHistoricalPrecision(a,b,opt={}){
  const alpha=Number.isFinite(Number(opt.alpha))?Number(opt.alpha):.05,power=Number.isFinite(Number(opt.power))?Number(opt.power):.80;
  const meanA=Number(a?.primaryMean),meanB=Number(b?.primaryMean),nA=Math.round(Number(a?.nDays)),nB=Math.round(Number(b?.nDays));
  if(!(Number.isFinite(meanA)&&Number.isFinite(meanB)&&Math.abs(meanA)>1e-9&&nA>1&&nB>1))return{status:'NOT_IDENTIFIED',reason:'INSUFFICIENT_TWO_REGIME_DATA',nA:Number.isFinite(nA)?nA:0,nB:Number.isFinite(nB)?nB:0};
  const varA=varianceFor(a),varB=varianceFor(b);
  if(!(varA>=0&&varB>=0))return{status:'NOT_IDENTIFIED',reason:'INVALID_VARIANCE',nA,nB};
  const varianceTerm=varA/nA+varB/nB,se=Math.sqrt(varianceTerm),zAlpha=normalQuantile(1-alpha/2),zPower=normalQuantile(power);
  const observedEffectRelative=(meanB-meanA)/Math.abs(meanA),mdeAbsApprox=(zAlpha+zPower)*se,mdeRelativeApprox=mdeAbsApprox/Math.abs(meanA);
  return{status:'IDENTIFIED',nA,nB,meanA,meanB,varA,varB,varianceTerm,se,observedEffectRelative,mdeRelativeApprox,alpha,power,assumption:'Historical two-regime precision diagnostic using Var_A/n_A + Var_B/n_B; bootstrap CI remains the primary uncertainty safeguard.'};
}
function estimateTestFeasibility(baselineMetrics,targetEffect,opt={}){
  const alpha=Number.isFinite(Number(opt.alpha))?Number(opt.alpha):.05,power=Number.isFinite(Number(opt.power))?Number(opt.power):.80,maxTestDays=Math.max(3,Math.round(Number(opt.maxTestDays)||28));
  const mean=Number(baselineMetrics?.primaryMean),rawVar=Number(baselineMetrics?.primaryVariance),effect=Math.abs(Number(targetEffect));
  if(!(mean>0)||!(effect>0)) return {feasible:false,status:'NO_FEASIBLE_TEST',reason:'Нет положительного baseline KPI или MDE.',requiredDays:Infinity,maxTestDays,powerSemantics:'FUTURE_TEST_FORECAST'};
  let variance=Number.isFinite(rawVar)&&rawVar>=0?rawVar:0;
  if(baselineMetrics?.primaryMode==='orders') variance=Math.max(variance,mean);
  if(!(variance>0)) variance=Math.max(Math.abs(mean)*.05,1e-6)**2;
  const zAlpha=normalQuantile(1-alpha/2),zPower=normalQuantile(power),delta=Math.abs(mean*effect);
  const requiredDays=Math.max(2,Math.ceil(2*(zAlpha+zPower)**2*variance/(delta*delta)));
  const feasible=requiredDays<=maxTestDays;
  const detectableAbs=Math.sqrt(2*(zAlpha+zPower)**2*variance/maxTestDays),detectableRelative=detectableAbs/Math.abs(mean);
  const requiredPrimaryKpi=baselineMetrics?.primaryMode==='orders'?Math.ceil(mean*requiredDays):Math.ceil(requiredDays);
  return {
    feasible,status:feasible?'FEASIBLE':'NO_FEASIBLE_TEST',requiredDays,maxTestDays,requiredPrimaryKpi,requiredPrimaryKpiName:baselineMetrics?.primaryKpiName||'primary KPI',
    targetEffect:effect,detectableRelativeAtMaxDays:detectableRelative,alpha,power,varianceUsed:variance,
    overdispersion:baselineMetrics?.primaryMode==='orders'&&mean>0?variance/mean:null,powerSemantics:'FUTURE_TEST_FORECAST',
    assumption:'Future-test forecast using baseline empirical variance, assuming equal-length baseline and target regimes with a Poisson variance floor for orders.'
  };
}
return {normalQuantile,estimateHistoricalPrecision,estimateTestFeasibility,_internals:{varianceFor}};
});
