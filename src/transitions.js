(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2Transitions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function median(a){const v=(a||[]).filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2}
function priceIn(priceResult,start,end){return median((priceResult?.daily||[]).filter(x=>x.reliable&&x.price>0&&x.date>=start&&x.date<=end).map(x=>x.price))}
function buildTransitions(cpcRegimes,budgetResult,priceResult,opt={}){
  const priceChangeTolerance=Number.isFinite(Number(opt.priceChangeTolerance))?Math.abs(Number(opt.priceChangeTolerance)):.03;
  const budgetCeilingTolerance=Number.isFinite(Number(opt.budgetCeilingTolerance))?Math.abs(Number(opt.budgetCeilingTolerance)):.15;
  const budgetBy=new Map((budgetResult?.states||[]).map(x=>[x.regimeId,x]));
  const out=[];
  for(let i=1;i<(cpcRegimes||[]).length;i++){
    const from=cpcRegimes[i-1],to=cpcRegimes[i],ba=budgetBy.get(from.id),bb=budgetBy.get(to.id),pa=priceIn(priceResult,from.startDate,from.endDate),pb=priceIn(priceResult,to.startDate,to.endDate);
    let code='CLEAN_CPC_TRANSITION',reason='Нет обнаруженных признаков одновременной смены эффективного бюджетного потолка или price regime.';
    const capChanged=[ba?.code,bb?.code].includes('BUDGET_CAP_CHANGED');
    const bothConstrained=ba?.code==='BUDGET_CONSTRAINED'&&bb?.code==='BUDGET_CONSTRAINED';
    const ceilingChanged=bothConstrained&&Number.isFinite(ba?.observedCeiling)&&Number.isFinite(bb?.observedCeiling)&&Math.abs(bb.observedCeiling/ba.observedCeiling-1)>budgetCeilingTolerance;
    const priceChanged=pa>0&&pb>0&&Math.abs(pb/pa-1)>priceChangeTolerance;
    const budgetUnknown=!ba||!bb||ba.code==='BUDGET_STATE_UNCERTAIN'||bb.code==='BUDGET_STATE_UNCERTAIN';
    const priceUnknown=!(pa>0&&pb>0)||priceResult?.status==='PRICE_DATA_INSUFFICIENT';
    if(capChanged||ceilingChanged){code='MIXED_CPC_BUDGET_TRANSITION';reason='Одновременно с CPC наблюдается вероятная смена эффективного бюджетного потолка.'}
    else if(priceChanged){code='PRICE_CONFOUNDED_TRANSITION';reason='Одновременно с CPC существенно изменился реализованный price regime.'}
    else if(budgetUnknown||priceUnknown){code='TRANSITION_UNCERTAIN';reason='Недостаточно данных, чтобы исключить смешение с budget/price regime.'}
    if(opt.otherConfounded===true){code='OTHER_CONFOUNDED_TRANSITION';reason='Обнаружено другое крупное вмешательство в период перехода.'}
    out.push({
      id:`T${i}`,
      fromRegimeId:from.id,toRegimeId:to.id,
      fromDate:from.endDate,toDate:to.startDate,
      fromCpc:from.cpcMedian??from.cpc,toCpc:to.cpcMedian??to.cpc,
      cpcChange:(to.cpcMedian??to.cpc)/(from.cpcMedian??from.cpc)-1,
      code,reason,evidenceType:'OBSERVATIONAL',
      fromBudgetState:ba?.code||'BUDGET_STATE_UNCERTAIN',toBudgetState:bb?.code||'BUDGET_STATE_UNCERTAIN',
      fromPrice:pa,toPrice:pb
    });
  }
  return out;
}
return {buildTransitions,_internals:{median,priceIn}};
});
