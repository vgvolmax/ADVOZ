(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./power.js'):root.OzonV2Power);
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2TestPlanner=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(W){
'use strict';
if(!W) throw new Error('power.js must be loaded before test_planner.js');
function no(reasonCode,reason,extra={}){return {status:'NO_FEASIBLE_TEST',reasonCode,reason,evidenceType:'OBSERVATIONAL',...extra}}
function planNextTest(context,opt={}){
  const b=context?.baselineMetrics||{},baseline=Number(b.cpc),curve=context?.responseCurve;
  if(!(baseline>0)) return no('NO_BASELINE_CPC','Не найден последний устойчивый AchievedCPC.');
  const direction=context.direction||(curve&&typeof curve.suggestDirection==='function'?curve.suggestDirection(baseline):null);
  if(!['UP','DOWN'].includes(direction)) return no('NO_SUPPORTED_DIRECTION','История не поддерживает однозначное направление следующего CPC-теста.');
  const noise=Math.max(0,Number(context.cpcNoise)||0),noiseMultiplier=Math.max(1,Number(opt.noiseMultiplier)||2.5);
  const minRelativeChange=Math.max(0,Number.isFinite(Number(opt.minRelativeChange))?Number(opt.minRelativeChange):.05);
  const minSeparationRelative=Math.max(minRelativeChange,Math.exp(noiseMultiplier*noise)-1);
  const maxStep=Math.max(.01,Number(opt.maxStep)||.15),defaultStep=Math.max(.01,Number(opt.defaultStep)||.05);
  if(minSeparationRelative>maxStep) return no('TEST_SEPARATION_INSUFFICIENT','Шум AchievedCPC слишком велик: безопасный шаг не отделяется от фоновой вариативности в допустимом диапазоне.',{minSeparationRelative,maxStep});
  let step=Math.min(maxStep,Math.max(defaultStep,minSeparationRelative*1.15));
  const maxExtrapolationRelative=Math.max(0,Number.isFinite(Number(opt.maxExtrapolationRelative))?Number(opt.maxExtrapolationRelative):.10);
  let target=baseline*(direction==='UP'?1+step:1-step);
  if(curve?.maxCpc>0&&direction==='UP'&&baseline>=curve.maxCpc) target=Math.min(target,curve.maxCpc*(1+maxExtrapolationRelative));
  if(curve?.minCpc>0&&direction==='DOWN'&&baseline<=curve.minCpc) target=Math.max(target,curve.minCpc*(1-maxExtrapolationRelative));
  step=Math.abs(target/baseline-1);
  if(step<minSeparationRelative*.999) return no('TEST_SEPARATION_INSUFFICIENT','Ограничение локальной экстраполяции не позволяет отделить TargetCPC от фонового CPC-шума.',{minSeparationRelative,allowedStep:step});
  const mdeRelative=Math.max(.01,Number(opt.mdeRelative)||.20),feasibility=W.estimateTestFeasibility(b,mdeRelative,opt);
  if(!feasibility.feasible) return no('POWER_INFEASIBLE','Нужную мощность нельзя получить за разумный максимальный срок теста.',{feasibility});
  const corridorRel=Math.min(step*.4,Math.max(.015,Math.exp(Math.max(noise,0)*1.5)-1));
  const stabilizationRaw=Number(opt.stabilizationDays),stabilizationDays=Math.max(0,Math.round(Number.isFinite(stabilizationRaw)?stabilizationRaw:2));
  const minFullDays=Math.max(Math.round(Number(opt.minFullDays)||4),feasibility.requiredDays);
  const stopLoss=b.primaryMode==='profit'
    ?{code:'ECONOMIC',metric:'contributionProfit/day',relativeDecline:Math.abs(Number(opt.stopLossRelative)||.20),text:`Остановить режим при устойчивом ухудшении contributionProfit/day более чем на ${Math.round(Math.abs(Number(opt.stopLossRelative)||.20)*100)}%.`}
    :{code:'STOP_LOSS_NEEDS_ECONOMICS',metric:'orders/day',relativeDecline:Math.abs(Number(opt.safetyOrderDecline)||.25),text:'Полноценный экономический stop-loss требует маржинальных входов; до этого доступен только safety-guardrail по orders/day.'};
  const card={
    baselineAchievedCpc:baseline,targetCpc:target,targetCorridor:{low:target*(1-corridorRel),high:target*(1+corridorRel),relativeHalfWidth:corridorRel},
    minSeparation:{relative:minSeparationRelative,absolute:baseline*minSeparationRelative},minFullDays,requiredPrimaryKpi:{name:feasibility.requiredPrimaryKpiName,value:feasibility.requiredPrimaryKpi},
    maxTestDays:feasibility.maxTestDays,stabilizationDays,stopLoss,
    mixedConditions:['BUDGET_CAP_CHANGED или иной вероятный сдвиг effective budget regime','существенная смена price regime','stock/availability issue, если доступно','разрыв данных','сильный временной structural break','AchievedCPC не отделился от baseline','режим короче минимальной длительности','конфликт лагов','другое обнаруживаемое крупное вмешательство'],
    reloadWhen:`Повторно загрузить отчёт после минимум ${minFullDays} полных evaluation-дней нового устойчивого режима и достижения ${feasibility.requiredPrimaryKpi} по ${feasibility.requiredPrimaryKpiName}; stabilization ${stabilizationDays} дн. считается отдельно.`,
    possibleDecisions:['DEPLOY','ROLLBACK','EXTEND','INCONCLUSIVE','NO_FEASIBLE_TEST'],mdeRelative,alpha:feasibility.alpha,power:feasibility.power
  };
  return {status:'RECOMMENDED',direction,targetCpc:target,stepPct:(target/baseline-1),evidenceType:'OBSERVATIONAL',feasibility,card};
}
return {planNextTest};
});
