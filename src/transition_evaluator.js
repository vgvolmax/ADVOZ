(function(root,factory){
  const api=factory(
    typeof module==='object'&&module.exports?require('./power.js'):root.OzonV2Power,
    typeof module==='object'&&module.exports?require('./temporal_adjustment.js'):root.OzonV2TemporalAdjustment
  );
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2TransitionEvaluator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(W,Q){
'use strict';
if(!W) throw new Error('power.js must be loaded before transition_evaluator.js');
if(!Q) throw new Error('temporal_adjustment.js must be loaded before transition_evaluator.js');
function evaluateTransitions(transitions,metrics,opt={}){
  const by=new Map((metrics||[]).map(x=>[x.regimeId,x]));
  const regimeBy=new Map((opt.regimes||[]).map(x=>[x.id,x]));
  const mde=Math.max(.01,Number(opt.mdeRelative)||.20),stopLoss=Math.max(.01,Math.abs(Number(opt.stopLossRelative)||.20));
  return (transitions||[]).map(t=>{
    const a=by.get(t.fromRegimeId),b=by.get(t.toRegimeId);
    if(t.code!=='CLEAN_CPC_TRANSITION') return {...t,decision:'INCONCLUSIVE',decisionReason:'Переход не классифицирован как чистый CPC-transition.',basis:'OBSERVATIONAL'};
    if(!(a&&b&&Number.isFinite(a.primaryMean)&&Number.isFinite(b.primaryMean)&&a.primaryMean>0)) return {...t,decision:'INCONCLUSIVE',decisionReason:'Primary KPI недостаточно восстановлен.',basis:'OBSERVATIONAL'};

    const rawEffect=b.primaryMean/a.primaryMean-1;
    let effect=rawEffect,effectSource='UNADJUSTED_OBSERVATIONAL',temporal=null;
    const fromRegime=regimeBy.get(t.fromRegimeId),toRegime=regimeBy.get(t.toRegimeId);
    if(fromRegime&&toRegime){
      temporal=Q.evaluateTemporalTransition(t,fromRegime,toRegime,a,b,{...(opt.temporal||{}),economicsSettings:opt.economicsSettings||{}});
      if(temporal.status==='LAG_SENSITIVE') return {...t,decision:'INCONCLUSIVE',decisionReason:'Temporal calibration чувствительна к lag 0/+1/+2; направление эффекта недостаточно устойчиво.',basis:'OBSERVATIONAL',rawEffectRelative:rawEffect,effectRelative:rawEffect,effectSource:'UNADJUSTED_DIAGNOSTIC',primaryKpiName:a.primaryKpiName,temporal};
      if(temporal.status==='LAG_NOT_IDENTIFIED') return {...t,decision:'INCONCLUSIVE',decisionReason:'Temporal lag/weekday/trend effect не идентифицирован на доступной длине режимов.',basis:'OBSERVATIONAL',rawEffectRelative:rawEffect,effectRelative:rawEffect,effectSource:'UNADJUSTED_DIAGNOSTIC',primaryKpiName:a.primaryKpiName,temporal};
      if(temporal.status==='LAG_STABLE'&&Number.isFinite(temporal.representativeEffectRelative)){
        effect=temporal.representativeEffectRelative;
        effectSource='TEMPORAL_ADJUSTED';
      }
    }

    const feasibility=W.estimateTestFeasibility(a,mde,opt);
    let decision='INCONCLUSIVE',decisionReason='Наблюдаемый эффект меньше business-relevant MDE.';
    if(effect<=-stopLoss){decision='ROLLBACK';decisionReason='Скорректированное наблюдаемое ухудшение превышает operational stop-loss.'}
    else if(!feasibility.feasible||b.nDays<feasibility.requiredDays){
      if(effect>0){decision='EXTEND';decisionReason='Направление положительное, но мощности/длительности недостаточно.'}
      else {decision='INCONCLUSIVE';decisionReason='Мощности недостаточно для интерпретации отрицательного/малого эффекта.'}
    } else if(effect>=mde){decision='DEPLOY';decisionReason='Скорректированный наблюдаемый эффект не менее MDE при достаточной длительности.'}
    else if(effect<=-mde){decision='ROLLBACK';decisionReason='Скорректированный наблюдаемый эффект хуже baseline не менее чем на MDE.'}
    return {...t,decision,decisionReason,basis:'OBSERVATIONAL',rawEffectRelative:rawEffect,effectRelative:effect,effectSource,primaryKpiName:a.primaryKpiName,feasibility,temporal};
  });
}
return {evaluateTransitions};
});
