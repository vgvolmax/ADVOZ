(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./power.js'):root.OzonV2Power);
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2TransitionEvaluator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(W){
'use strict';
if(!W) throw new Error('power.js must be loaded before transition_evaluator.js');
function evaluateTransitions(transitions,metrics,opt={}){
  const by=new Map((metrics||[]).map(x=>[x.regimeId,x]));
  const mde=Math.max(.01,Number(opt.mdeRelative)||.20),stopLoss=Math.max(.01,Math.abs(Number(opt.stopLossRelative)||.20));
  return (transitions||[]).map(t=>{
    const a=by.get(t.fromRegimeId),b=by.get(t.toRegimeId);
    if(t.code!=='CLEAN_CPC_TRANSITION') return {...t,decision:'INCONCLUSIVE',decisionReason:'Переход не классифицирован как чистый CPC-transition.',basis:'OBSERVATIONAL'};
    if(!(a&&b&&Number.isFinite(a.primaryMean)&&Number.isFinite(b.primaryMean)&&a.primaryMean>0)) return {...t,decision:'INCONCLUSIVE',decisionReason:'Primary KPI недостаточно восстановлен.',basis:'OBSERVATIONAL'};
    const effect=b.primaryMean/a.primaryMean-1;
    const feasibility=W.estimateTestFeasibility(a,mde,opt);
    let decision='INCONCLUSIVE',decisionReason='Наблюдаемый эффект меньше business-relevant MDE.';
    if(effect<=-stopLoss){decision='ROLLBACK';decisionReason='Наблюдается ухудшение, превышающее operational stop-loss.'}
    else if(!feasibility.feasible||b.nDays<feasibility.requiredDays){
      if(effect>0){decision='EXTEND';decisionReason='Направление положительное, но мощности/длительности недостаточно.'}
      else {decision='INCONCLUSIVE';decisionReason='Мощности недостаточно для интерпретации отрицательного/малого эффекта.'}
    } else if(effect>=mde){decision='DEPLOY';decisionReason='Новый режим лучше baseline не менее чем на заданный MDE при достаточной длительности.'}
    else if(effect<=-mde){decision='ROLLBACK';decisionReason='Новый режим хуже baseline не менее чем на заданный MDE при достаточной длительности.'}
    return {...t,decision,decisionReason,basis:'OBSERVATIONAL',effectRelative:effect,primaryKpiName:a.primaryKpiName,feasibility};
  });
}
return {evaluateTransitions};
});
