(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./economics.js'):root.OzonV2Economics);
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2TemporalAdjustment=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E){
'use strict';

function mean(a){const v=(a||[]).filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null}
function median(a){const v=(a||[]).filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2}
function dayNumber(iso){const t=Date.parse(String(iso)+'T00:00:00Z');return Number.isFinite(t)?Math.round(t/86400000):null}
function weekday(iso){const t=Date.parse(String(iso)+'T00:00:00Z');return Number.isFinite(t)?new Date(t).getUTCDay():null}

function primaryValue(row,mode,economicsSettings){
  if(mode==='profit') return E&&typeof E.contributionProfit==='function'?E.contributionProfit(row,economicsSettings||{}):null;
  if(row?.safeOrderReliable&&Number.isFinite(Number(row.safeOrderUnits))) return Number(row.safeOrderUnits);
  if(row?.orderReliable&&Number.isFinite(Number(row.orderUnitsEstimate))) return Number(row.orderUnitsEstimate);
  return null;
}

function solveLinear(A,b,tol=1e-10){
  const n=A.length;
  const m=A.map((r,i)=>r.slice().concat([b[i]]));
  for(let c=0;c<n;c++){
    let pivot=c;
    for(let r=c+1;r<n;r++) if(Math.abs(m[r][c])>Math.abs(m[pivot][c])) pivot=r;
    if(Math.abs(m[pivot][c])<=tol) return null;
    if(pivot!==c){const tmp=m[c];m[c]=m[pivot];m[pivot]=tmp}
    const div=m[c][c];
    for(let j=c;j<=n;j++) m[c][j]/=div;
    for(let r=0;r<n;r++){
      if(r===c) continue;
      const f=m[r][c];
      if(Math.abs(f)<=tol) continue;
      for(let j=c;j<=n;j++) m[r][j]-=f*m[c][j];
    }
  }
  return m.map(r=>r[n]);
}

function fitAdjustedEffect(observations,opt={}){
  const obs=(observations||[]).filter(o=>Number.isFinite(o.y)&&Number.isFinite(o.time)&&Number.isInteger(o.weekday));
  const weekdays=[...new Set(obs.map(o=>o.weekday))].sort((a,b)=>a-b);
  const baselineWeekday=weekdays[0];
  const dummyDays=weekdays.slice(1);
  const p=3+dummyDays.length; // intercept, treatment, trend, weekday FE
  const minResidualDf=Math.max(2,Math.round(Number(opt.minResidualDf)||3));
  if(obs.length<p+minResidualDf) return {status:'NOT_IDENTIFIED',reason:'INSUFFICIENT_DF',n:obs.length,p};
  if(!obs.some(o=>o.treatment===0)||!obs.some(o=>o.treatment===1)) return {status:'NOT_IDENTIFIED',reason:'NO_TREATMENT_CONTRAST',n:obs.length,p};

  const tMean=mean(obs.map(o=>o.time));
  const tScale=Math.max(1,...obs.map(o=>Math.abs(o.time-tMean)));
  const X=obs.map(o=>[1,o.treatment,(o.time-tMean)/tScale,...dummyDays.map(d=>o.weekday===d?1:0)]);
  const y=obs.map(o=>o.y);
  const XtX=Array.from({length:p},()=>Array(p).fill(0)),Xty=Array(p).fill(0);
  for(let i=0;i<X.length;i++){
    for(let a=0;a<p;a++){
      Xty[a]+=X[i][a]*y[i];
      for(let b=0;b<p;b++) XtX[a][b]+=X[i][a]*X[i][b];
    }
  }
  const beta=solveLinear(XtX,Xty,Number(opt.rankTolerance)||1e-10);
  if(!beta) return {status:'NOT_IDENTIFIED',reason:'RANK_DEFICIENT',n:obs.length,p};
  const baselineMean=mean(obs.filter(o=>o.treatment===0).map(o=>o.y));
  const testMean=mean(obs.filter(o=>o.treatment===1).map(o=>o.y));
  if(!Number.isFinite(baselineMean)||Math.abs(baselineMean)<1e-9) return {status:'NOT_IDENTIFIED',reason:'BASELINE_NEAR_ZERO',n:obs.length,p};
  const treatmentEffect=beta[1];
  return {
    status:'IDENTIFIED',n:obs.length,p,baselineWeekday,dummyDays,
    baselineMean,testMean,
    rawEffectRelative:testMean/baselineMean-1,
    treatmentEffect,
    adjustedEffectRelative:treatmentEffect/baselineMean,
    trendCoefficientScaled:beta[2]
  };
}

function observationsForLag(fromRegime,toRegime,mode,lag,economicsSettings){
  const from=(fromRegime?.days||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const to=(toRegime?.days||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(Math.max(0,lag));
  const all=[];
  for(const [treat,rows] of [[0,from],[1,to]]) for(const r of rows){
    const y=primaryValue(r,mode,economicsSettings),time=dayNumber(r.date),wd=weekday(r.date);
    if(Number.isFinite(y)&&Number.isFinite(time)&&Number.isInteger(wd)) all.push({date:r.date,y,time,weekday:wd,treatment:treat});
  }
  return all;
}

function summarizeLagResults(results,opt={}){
  const identified=(results||[]).filter(r=>r.status==='IDENTIFIED'&&Number.isFinite(r.adjustedEffectRelative));
  if(!identified.length) return {status:'LAG_NOT_IDENTIFIED',representativeEffectRelative:null,identifiedLags:[]};
  const signEpsilon=Math.max(0,Number.isFinite(Number(opt.signEpsilon))?Math.abs(Number(opt.signEpsilon)):.02);
  const maxLagSpread=Math.max(0,Number.isFinite(Number(opt.maxLagSpread))?Math.abs(Number(opt.maxLagSpread)):.25);
  const effects=identified.map(r=>r.adjustedEffectRelative);
  const signs=new Set(effects.map(x=>x>signEpsilon?1:x<-signEpsilon?-1:0));
  const hasConflict=signs.has(1)&&signs.has(-1);
  const spread=Math.max(...effects)-Math.min(...effects);
  return {
    status:hasConflict||spread>maxLagSpread?'LAG_SENSITIVE':'LAG_STABLE',
    representativeEffectRelative:median(effects),
    identifiedLags:identified.map(r=>r.lag),
    spread,hasSignConflict:hasConflict
  };
}

function evaluateTemporalTransition(transition,fromRegime,toRegime,fromMetrics,toMetrics,opt={}){
  if(transition?.code&&transition.code!=='CLEAN_CPC_TRANSITION') return {status:'LAG_NOT_APPLICABLE',basis:'OBSERVATIONAL',lagResults:[]};
  const mode=fromMetrics?.primaryMode||toMetrics?.primaryMode||'orders';
  const lags=Array.isArray(opt.lags)&&opt.lags.length?opt.lags:[0,1,2];
  const lagResults=lags.map(rawLag=>{
    const lag=Math.max(0,Math.round(Number(rawLag)||0));
    const fit=fitAdjustedEffect(observationsForLag(fromRegime,toRegime,mode,lag,opt.economicsSettings),opt);
    return {lag,...fit};
  });
  const summary=summarizeLagResults(lagResults,opt);
  return {...summary,basis:'OBSERVATIONAL',primaryMode:mode,lagResults};
}

return {evaluateTemporalTransition,_internals:{mean,median,dayNumber,weekday,primaryValue,solveLinear,fitAdjustedEffect,observationsForLag,summarizeLagResults}};
});
