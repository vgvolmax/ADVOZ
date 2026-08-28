(function(root,factory){
  const api=factory(
    typeof module==='object'&&module.exports?require('./power.js'):root.OzonV2Power,
    typeof module==='object'&&module.exports?require('./temporal_adjustment.js'):root.OzonV2TemporalAdjustment,
    typeof module==='object'&&module.exports?require('./uncertainty.js'):root.OzonV2Uncertainty
  );
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2TransitionEvaluator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(W,Q,U){
'use strict';
if(!W) throw new Error('power.js must be loaded before transition_evaluator.js');
if(!Q) throw new Error('temporal_adjustment.js must be loaded before transition_evaluator.js');
if(!U) throw new Error('uncertainty.js must be loaded before transition_evaluator.js');
function evaluateTransitions(transitions,metrics,opt={}){
  const by=new Map((metrics||[]).map(x=>[x.regimeId,x]));
  const regimeBy=new Map((opt.regimes||[]).map(x=>[x.id,x]));
  const mde=Math.max(.01,Number(opt.mdeRelative)||.20),stopLoss=Math.max(.01,Math.abs(Number(opt.stopLossRelative)||.20));
  return (transitions||[]).map(t=>{
    const a=by.get(t.fromRegimeId),b=by.get(t.toRegimeId);
    if(t.code!=='CLEAN_CPC_TRANSITION') return {...t,decision:'INCONCLUSIVE',decisionReason:'Переход не классифицирован как чистый CPC-transition.',basis:'OBSERVATIONAL'};
    if(!(a&&b&&Number.isFinite(a.primaryMean)&&Number.isFinite(b.primaryMean)&&a.primaryMean>0)) return {...t,decision:'INCONCLUSIVE',decisionReason:'Primary KPI недостаточно восстановлен.',basis:'OBSERVATIONAL'};
    if(a.primaryMode&&b.primaryMode&&a.primaryMode!==b.primaryMode)return {...t,decision:'INCONCLUSIVE',decisionReason:'Primary KPI имеет несовместимые единицы между режимами.',basis:'OBSERVATIONAL',reasonCode:'PRIMARY_KPI_MISMATCH'};
    if(a.primaryUsable===false||b.primaryUsable===false)return {...t,decision:'INCONCLUSIVE',decisionReason:'Покрытие выбранного primary KPI недостаточно хотя бы в одном режиме.',basis:'OBSERVATIONAL',reasonCode:'PRIMARY_KPI_LOW_COVERAGE'};

    const rawEffect=b.primaryMean/a.primaryMean-1;
    const historicalPrecision=W.estimateHistoricalPrecision(a,b,opt);
    if(historicalPrecision.status!=='IDENTIFIED')return {...t,decision:'INCONCLUSIVE',decisionReason:'Историческая двухрежимная точность не идентифицирована.',basis:'OBSERVATIONAL',rawEffectRelative:rawEffect,effectRelative:rawEffect,effectSource:'UNADJUSTED_DIAGNOSTIC',primaryKpiName:a.primaryKpiName,historicalPrecision};

    const fromRegime=regimeBy.get(t.fromRegimeId),toRegime=regimeBy.get(t.toRegimeId);
    if(!(fromRegime&&toRegime)) return {...t,decision:'INCONCLUSIVE',decisionReason:'Для temporal calibration отсутствуют полные regime blocks.',basis:'OBSERVATIONAL',rawEffectRelative:rawEffect,effectRelative:rawEffect,effectSource:'UNADJUSTED_DIAGNOSTIC',primaryKpiName:a.primaryKpiName,historicalPrecision};

    const temporal=Q.evaluateTemporalTransition(t,fromRegime,toRegime,a,b,{...(opt.temporal||{}),economicsSettings:opt.economicsSettings||{}});
    if(temporal.status==='LAG_SENSITIVE') return {...t,decision:'INCONCLUSIVE',decisionReason:'Temporal calibration чувствительна к lag 0/+1/+2; направление эффекта недостаточно устойчиво.',basis:'OBSERVATIONAL',rawEffectRelative:rawEffect,effectRelative:rawEffect,effectSource:'UNADJUSTED_DIAGNOSTIC',primaryKpiName:a.primaryKpiName,temporal,historicalPrecision};
    if(temporal.status!=='LAG_STABLE'||!Number.isFinite(temporal.representativeEffectRelative)) return {...t,decision:'INCONCLUSIVE',decisionReason:'Temporal lag/weekday/trend effect не идентифицирован на доступной длине режимов.',basis:'OBSERVATIONAL',rawEffectRelative:rawEffect,effectRelative:rawEffect,effectSource:'UNADJUSTED_DIAGNOSTIC',primaryKpiName:a.primaryKpiName,temporal,historicalPrecision};

    const effect=temporal.representativeEffectRelative,effectSource='TEMPORAL_ADJUSTED';
    const uncertainty=U.estimateTemporalUncertainty(t,temporal,fromRegime,toRegime,a,b,{...(opt.uncertainty||{}),economicsSettings:opt.economicsSettings||{}});
    if(uncertainty.status!=='UNCERTAINTY_IDENTIFIED') return {...t,decision:'INCONCLUSIVE',decisionReason:'Bootstrap uncertainty не идентифицирована; сильное решение заблокировано.',basis:'OBSERVATIONAL',rawEffectRelative:rawEffect,effectRelative:effect,effectSource,primaryKpiName:a.primaryKpiName,temporal,uncertainty,historicalPrecision};

    const ci=uncertainty.ci,directionSupported=effect>0?ci.low>0:effect<0?ci.high<0:false;
    if(!directionSupported){
      const decision=effect>0?'EXTEND':'INCONCLUSIVE';
      return {...t,decision,decisionReason:'Bootstrap confidence interval пересекает ноль; направление недостаточно устойчиво для сильного решения.',basis:'OBSERVATIONAL',rawEffectRelative:rawEffect,effectRelative:effect,effectSource,primaryKpiName:a.primaryKpiName,temporal,uncertainty,historicalPrecision};
    }

    const precisionEnough=historicalPrecision.mdeRelativeApprox<=mde;
    if(!precisionEnough){
      const decision=effect>0?'EXTEND':'INCONCLUSIVE';
      return {...t,decision,decisionReason:'Направление поддержано bootstrap, но двухрежимной исторической точности недостаточно для business-relevant MDE.',basis:'OBSERVATIONAL',rawEffectRelative:rawEffect,effectRelative:effect,effectSource,primaryKpiName:a.primaryKpiName,temporal,uncertainty,historicalPrecision};
    }

    let decision='INCONCLUSIVE',decisionReason='Скорректированный эффект меньше business-relevant MDE.';
    if(effect<=-stopLoss){decision='ROLLBACK';decisionReason='Скорректированное ухудшение превышает stop-loss, bootstrap interval поддерживает направление и двухрежимная точность достаточна.'}
    else if(effect>=mde){decision='DEPLOY';decisionReason='Скорректированный эффект не менее MDE, bootstrap interval поддерживает направление и двухрежимная точность достаточна.'}
    else if(effect<=-mde){decision='ROLLBACK';decisionReason='Скорректированный эффект хуже baseline не менее чем на MDE, bootstrap interval поддерживает направление и двухрежимная точность достаточна.'}
    return {...t,decision,decisionReason,basis:'OBSERVATIONAL',rawEffectRelative:rawEffect,effectRelative:effect,effectSource,primaryKpiName:a.primaryKpiName,temporal,uncertainty,historicalPrecision};
  });
}
return {evaluateTransitions};
});
