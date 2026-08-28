(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./temporal_adjustment.js'):root.OzonV2TemporalAdjustment);
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2Uncertainty=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T){
'use strict';
if(!T) throw new Error('temporal_adjustment.js must be loaded before uncertainty.js');

function mean(a){const v=(a||[]).filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null}
function quantile(a,q){const v=(a||[]).filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!v.length)return null;const p=Math.max(0,Math.min(1,q))*(v.length-1),lo=Math.floor(p),hi=Math.ceil(p);return lo===hi?v[lo]:v[lo]+(v[hi]-v[lo])*(p-lo)}
function rngFromSeed(seed){let a=(Number(seed)||1)>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

function buildFit(observations,includeTreatment=true,opt={}){
  const obs=(observations||[]).filter(o=>Number.isFinite(o.y)&&Number.isFinite(o.time)&&Number.isInteger(o.weekday)&&(o.treatment===0||o.treatment===1));
  if(!obs.some(o=>o.treatment===0)||!obs.some(o=>o.treatment===1)) return null;
  const weekdays=[...new Set(obs.map(o=>o.weekday))].sort((a,b)=>a-b),dummyDays=weekdays.slice(1);
  const p=2+dummyDays.length+(includeTreatment?1:0); // intercept, optional treatment, trend, weekday FE
  const minResidualDf=Math.max(2,Math.round(Number(opt.minResidualDf)||3));
  if(obs.length<p+minResidualDf) return null;
  const tMean=mean(obs.map(o=>o.time)),tScale=Math.max(1,...obs.map(o=>Math.abs(o.time-tMean)));
  const X=obs.map(o=>{
    const x=[1];if(includeTreatment)x.push(o.treatment);x.push((o.time-tMean)/tScale);for(const d of dummyDays)x.push(o.weekday===d?1:0);return x;
  });
  const y=obs.map(o=>o.y),XtX=Array.from({length:p},()=>Array(p).fill(0)),Xty=Array(p).fill(0);
  for(let i=0;i<X.length;i++)for(let a=0;a<p;a++){Xty[a]+=X[i][a]*y[i];for(let b=0;b<p;b++)XtX[a][b]+=X[i][a]*X[i][b]}
  const beta=T._internals.solveLinear(XtX,Xty,Number(opt.rankTolerance)||1e-10);if(!beta)return null;
  const fitted=X.map(row=>row.reduce((s,x,j)=>s+x*beta[j],0)),residuals=y.map((v,i)=>v-fitted[i]);
  const baselineMean=mean(obs.filter(o=>o.treatment===0).map(o=>o.y));
  if(!Number.isFinite(baselineMean)||Math.abs(baselineMean)<1e-9)return null;
  return{obs,X,y,beta,fitted,residuals,baselineMean,effectRelative:includeTreatment?beta[1]/baselineMean:null,p};
}

function fitEffectOnFixedDesign(fit,yStar,opt={}){
  const X=fit.X,p=fit.p,XtX=Array.from({length:p},()=>Array(p).fill(0)),Xty=Array(p).fill(0);
  for(let i=0;i<X.length;i++)for(let a=0;a<p;a++){Xty[a]+=X[i][a]*yStar[i];for(let b=0;b<p;b++)XtX[a][b]+=X[i][a]*X[i][b]}
  const beta=T._internals.solveLinear(XtX,Xty,Number(opt.rankTolerance)||1e-10);if(!beta)return null;
  const baseline=mean(fit.obs.filter(o=>o.treatment===0).map((o,i)=>({o,i})).map(z=>yStar[z.i]));
  if(!Number.isFinite(baseline)||Math.abs(baseline)<1e-9)return null;
  return beta[1]/baseline;
}

function blockResampleWithinTreatment(obs,residuals,blockSize,rng){
  const out=Array(residuals.length).fill(0);
  for(const treat of [0,1]){
    const idx=[];for(let i=0;i<obs.length;i++)if(obs[i].treatment===treat)idx.push(i);
    if(!idx.length)continue;
    const pool=idx.map(i=>residuals[i]),generated=[];
    while(generated.length<idx.length){const start=Math.floor(rng()*pool.length);for(let k=0;k<blockSize&&generated.length<idx.length;k++)generated.push(pool[(start+k)%pool.length])}
    const m=mean(generated)||0; // preserve shape while removing accidental block mean drift
    for(let j=0;j<idx.length;j++)out[idx[j]]=generated[j]-m;
  }
  return out;
}

function representativeLag(temporal){
  const identified=(temporal?.lagResults||[]).filter(r=>r.status==='IDENTIFIED'&&Number.isFinite(r.adjustedEffectRelative));
  if(!identified.length)return null;
  const target=Number.isFinite(temporal.representativeEffectRelative)?temporal.representativeEffectRelative:identified[0].adjustedEffectRelative;
  return identified.slice().sort((a,b)=>Math.abs(a.adjustedEffectRelative-target)-Math.abs(b.adjustedEffectRelative-target)||a.lag-b.lag)[0].lag;
}

function estimateTemporalUncertainty(transition,temporal,fromRegime,toRegime,fromMetrics,toMetrics,opt={}){
  const notIdentified=(reason)=>({status:'UNCERTAINTY_NOT_IDENTIFIED',reason,method:'MOVING_BLOCK_RESIDUAL_BOOTSTRAP',basis:'OBSERVATIONAL',pValue:null,ci:null});
  if(transition?.code&&transition.code!=='CLEAN_CPC_TRANSITION')return notIdentified('NOT_CLEAN_TRANSITION');
  if(temporal?.status!=='LAG_STABLE')return notIdentified('TEMPORAL_NOT_STABLE');
  const lag=representativeLag(temporal);if(lag==null)return notIdentified('NO_IDENTIFIED_LAG');
  const mode=fromMetrics?.primaryMode||toMetrics?.primaryMode||temporal?.primaryMode||'orders';
  const obs=T._internals.observationsForLag(fromRegime,toRegime,mode,lag,opt.economicsSettings||{});
  const full=buildFit(obs,true,opt),reduced=buildFit(obs,false,opt);if(!(full&&reduced))return notIdentified('DESIGN_NOT_IDENTIFIED');
  const minPerGroup=Math.min(obs.filter(o=>o.treatment===0).length,obs.filter(o=>o.treatment===1).length);
  if(minPerGroup<6)return notIdentified('TOO_FEW_DAYS_PER_REGIME');
  const reps=Math.max(100,Math.round(Number(opt.reps)||400)),alpha=Math.max(.001,Math.min(.25,Number(opt.alpha)||.05));
  const blockSize=Math.max(2,Math.min(minPerGroup,Math.round(Number(opt.blockSize)||Math.pow(obs.length,1/3)||2)));
  const rng=rngFromSeed(opt.seed??20260828),ciDist=[],nullDist=[];
  for(let b=0;b<reps;b++){
    const e=blockResampleWithinTreatment(obs,full.residuals,blockSize,rng);
    const yFull=full.fitted.map((v,i)=>v+e[i]),effFull=fitEffectOnFixedDesign(full,yFull,opt);if(Number.isFinite(effFull))ciDist.push(effFull);
    const yNull=reduced.fitted.map((v,i)=>v+e[i]),effNull=fitEffectOnFixedDesign(full,yNull,opt);if(Number.isFinite(effNull))nullDist.push(effNull);
  }
  const minValid=Math.max(80,Math.floor(reps*.8));if(ciDist.length<minValid||nullDist.length<minValid)return notIdentified('TOO_FEW_VALID_BOOTSTRAPS');
  const observed=full.effectRelative,low=quantile(ciDist,alpha/2),high=quantile(ciDist,1-alpha/2);
  const extreme=nullDist.filter(x=>Math.abs(x)>=Math.abs(observed)).length,pValue=(extreme+1)/(nullDist.length+1);
  return{status:'UNCERTAINTY_IDENTIFIED',method:'MOVING_BLOCK_RESIDUAL_BOOTSTRAP',basis:'OBSERVATIONAL',lag,n:obs.length,reps,validReps:ciDist.length,blockSize,estimateRelative:observed,ci:{level:1-alpha,low,high},pValue};
}

return{estimateTemporalUncertainty,_internals:{mean,quantile,rngFromSeed,buildFit,fitEffectOnFixedDesign,blockResampleWithinTreatment,representativeLag}};
});
