'use strict';

function defaultWeekday(day,strength){
  const s=Math.max(0,Number(strength)||0);
  const shape=[-.18,-.08,0,.04,.07,.10,.05];
  return Math.exp(shape[day%7]*s);
}
function generateLatentSeries(config={},rng){
  const days=Math.max(1,Math.round(Number(config.days)||90)),baseDemand=Math.max(1e-9,Number(config.baseDemand)||1);
  const weekdayStrength=Math.max(0,Number(config.weekdayStrength)||0),linearTrend=Number(config.linearTrend)||0;
  const phi=Math.max(-.95,Math.min(.95,Number(config.ar1Phi)||0)),sigma=Math.max(0,Number(config.ar1Sigma)||0);
  const supplied=Array.isArray(config.sharedShockSeries)?config.sharedShockSeries:[],sharedSigma=Math.max(0,Number(config.sharedShockSigma)||0);
  const weekdayMultiplier=[],trendMultiplier=[],ar1Shock=[],sharedShock=[],demand=[];let prev=0;
  for(let t=0;t<days;t++){
    const wd=typeof config.weekdayMultipliers?.[t%7]==='number'?Number(config.weekdayMultipliers[t%7]):defaultWeekday(t,weekdayStrength);
    const tr=Math.exp(linearTrend*t),innovation=sigma*rng.normal();prev=phi*prev+innovation;
    const sh=Number.isFinite(Number(supplied[t]))?Number(supplied[t]):(sharedSigma>0?sharedSigma*rng.normal():0);
    weekdayMultiplier.push(wd);trendMultiplier.push(tr);ar1Shock.push(prev);sharedShock.push(sh);
    demand.push(baseDemand*wd*tr*Math.exp(prev+sh));
  }
  return{demand,weekdayMultiplier,trendMultiplier,ar1Shock,sharedShock};
}
module.exports={generateLatentSeries,_internals:{defaultWeekday}};
