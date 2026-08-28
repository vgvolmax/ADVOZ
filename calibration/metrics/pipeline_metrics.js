'use strict';

function dayNumber(iso){const t=Date.parse(`${iso}T00:00:00Z`);return Number.isFinite(t)?Math.round(t/86400000):null}
function matchChangePoints(detectedDates=[],trueDates=[],toleranceDays=2){
  const tol=Math.max(0,Math.round(Number(toleranceDays)||0)),candidates=[];
  detectedDates.forEach((d,di)=>trueDates.forEach((t,ti)=>{const a=dayNumber(d),b=dayNumber(t);if(a!=null&&b!=null){const err=Math.abs(a-b);if(err<=tol)candidates.push({di,ti,detectedDate:d,trueDate:t,absErrorDays:err})}}));
  candidates.sort((a,b)=>a.absErrorDays-b.absErrorDays||a.di-b.di||a.ti-b.ti);
  const usedD=new Set(),usedT=new Set(),matches=[];
  for(const c of candidates)if(!usedD.has(c.di)&&!usedT.has(c.ti)){usedD.add(c.di);usedT.add(c.ti);matches.push(c)}
  const tp=matches.length,fp=Math.max(0,detectedDates.length-tp),fn=Math.max(0,trueDates.length-tp);
  return{matches,truePositives:tp,falsePositives:fp,falseNegatives:fn,recall:trueDates.length?tp/trueDates.length:detectedDates.length?0:1,precision:detectedDates.length?tp/detectedDates.length:trueDates.length?0:1,meanAbsDateErrorDays:tp?matches.reduce((s,x)=>s+x.absErrorDays,0)/tp:null};
}
function classMatches(actual,expected){
  if(!expected)return null;
  if(expected==='UNCERTAIN_OR_CONFOUNDED')return actual!=='CLEAN_CPC_TRANSITION';
  if(expected==='MIXED_OR_UNCERTAIN')return ['MIXED_CPC_BUDGET_TRANSITION','TRANSITION_UNCERTAIN','OTHER_CONFOUNDED_TRANSITION'].includes(actual);
  return actual===expected;
}
function scorePipeline(analysis,truth,expectations={}){
  const detected=(analysis?.cpcChangePoints||[]).map(x=>x.date).filter(Boolean),trueDates=truth?.changePointDates||[],changePoints=matchChangePoints(detected,trueDates,2),classes=(analysis?.transitions||[]).map(t=>t.code),reasonCodes=(analysis?.transitions||[]).map(t=>t.reasonCode).filter(Boolean);
  const expected=expectations.expectedTransitionClass||null;
  let classCorrect;
  if(expected)classCorrect=classes.length>0&&classes.some(x=>classMatches(x,expected));
  else if(truth?.structurallyClean&&trueDates.length)classCorrect=classes.some(x=>x==='CLEAN_CPC_TRANSITION');
  else classCorrect=classes.length===0||classes.every(x=>x!=='CLEAN_CPC_TRANSITION');
  return{changePoints,detectedTransitionClasses:classes,transitionReasonCodes:reasonCodes,classCorrect,regimeCountDetected:analysis?.cpcRegimes?.length||0,regimeCountTrue:truth?.cpcRegimes?.length||0,regimeCountError:(analysis?.cpcRegimes?.length||0)-(truth?.cpcRegimes?.length||0),dataGapDetected:truth?.confounders?.dataGap?reasonCodes.includes('DATA_GAP'):null,priceConfoundDetected:truth?.confounders?.priceChange?classes.includes('PRICE_CONFOUNDED_TRANSITION'):null,budgetConfoundNotClean:truth?.confounders?.budgetChange?classes.every(x=>x!=='CLEAN_CPC_TRANSITION'):null};
}
module.exports={matchChangePoints,scorePipeline,_internals:{dayNumber,classMatches}};
