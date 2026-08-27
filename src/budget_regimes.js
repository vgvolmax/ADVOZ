(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2BudgetRegimes=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function mean(a){const v=(a||[]).filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null}
function median(a){const v=(a||[]).filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2}
function sd(a){const v=(a||[]).filter(Number.isFinite);if(v.length<2)return 0;const m=mean(v);return Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1))}
function cv(a){const m=mean(a);return m&&m>0?sd(a)/m:null}
function dayDiff(a,b){const x=Date.parse(a+'T00:00:00Z'),y=Date.parse(b+'T00:00:00Z');return Number.isFinite(x)&&Number.isFinite(y)?Math.round((y-x)/86400000):null}
function rolling7d(days){
  const a=(days||[]).slice().sort((x,y)=>String(x.date).localeCompare(String(y.date))),out=[];
  for(let i=6;i<a.length;i++){
    const w=a.slice(i-6,i+1);
    if(dayDiff(w[0].date,w[6].date)!==6) continue;
    const spend=w.map(r=>Number(r.spend)).filter(Number.isFinite);
    if(spend.length!==7) continue;
    const clicks=w.reduce((s,r)=>s+(Number(r.clicks)||0),0),spend7=spend.reduce((s,x)=>s+x,0);
    out.push({startDate:w[0].date,endDate:w[6].date,spend7,clicks7:clicks,cpc7:clicks>0?spend7/clicks:null,nDays:7});
  }
  return out;
}
function classify(points,opt={}){
  const minRollingPoints=Math.max(3,Math.round(Number(opt.minRollingPoints)||5));
  const plateauCv=Number.isFinite(Number(opt.plateauCv))?Number(opt.plateauCv):.05;
  const unconstrainedCv=Number.isFinite(Number(opt.unconstrainedCv))?Number(opt.unconstrainedCv):.12;
  const capChangeRelative=Number.isFinite(Number(opt.capChangeRelative))?Number(opt.capChangeRelative):.20;
  if(points.length<minRollingPoints) return {code:'BUDGET_STATE_UNCERTAIN',reason:'Недостаточно полных rolling-7d окон.',rollingPoints:points.length,observedCeiling:null};
  const vals=points.map(p=>p.spend7),overallCv=cv(vals),first=vals.slice(0,minRollingPoints),last=vals.slice(-minRollingPoints),m1=median(first),m2=median(last),cv1=cv(first),cv2=cv(last);
  const rel=m1>0&&m2>0?Math.abs(m2/m1-1):0;
  if(points.length>=minRollingPoints*2 && rel>=capChangeRelative && cv1<=plateauCv && cv2<=plateauCv){
    const mid=(m1+m2)/2,up=m2>m1; let cp=points[Math.floor(points.length/2)];
    for(const p of points){if((up&&p.spend7>=mid)||(!up&&p.spend7<=mid)){cp=p;break}}
    return {code:'BUDGET_CAP_CHANGED',reason:'Обнаружен структурный сдвиг эффективного потолка rolling-7d расхода.',rollingPoints:points.length,observedCeiling:null,fromObservedLevel:m1,toObservedLevel:m2,changePoint:cp.endDate,cv:overallCv};
  }
  const med=median(vals),min=Math.min(...vals),max=Math.max(...vals),range=med>0?(max-min)/med:Infinity;
  if(overallCv!=null && overallCv<=plateauCv && range<=Math.max(.10,plateauCv*3)) return {code:'BUDGET_CONSTRAINED',reason:'Rolling-7d расход устойчиво держится у наблюдаемого эффективного потолка.',rollingPoints:points.length,observedCeiling:med,cv:overallCv};
  if(overallCv!=null && overallCv>=unconstrainedCv) return {code:'BUDGET_UNCONSTRAINED',reason:'Устойчивого потолка rolling-7d расхода не наблюдается.',rollingPoints:points.length,observedCeiling:null,cv:overallCv};
  return {code:'BUDGET_STATE_UNCERTAIN',reason:'Форма rolling-7d расхода допускает несколько объяснений.',rollingPoints:points.length,observedCeiling:null,cv:overallCv};
}
function inferEffectiveBudgetStates(days,cpcRegimes,opt={}){
  const rolling=rolling7d(days),states=[],changePoints=[];
  for(const r of cpcRegimes||[]){
    const pts=rolling.filter(p=>p.startDate>=r.startDate&&p.endDate<=r.endDate),c=classify(pts,opt),state={regimeId:r.id,startDate:r.startDate,endDate:r.endDate,...c};
    states.push(state);
    if(c.code==='BUDGET_CAP_CHANGED'&&c.changePoint) changePoints.push({date:c.changePoint,regimeId:r.id,fromObservedLevel:c.fromObservedLevel,toObservedLevel:c.toObservedLevel});
  }
  return {rolling,states,changePoints};
}
return {rolling7d,inferEffectiveBudgetStates,_internals:{mean,median,sd,cv,classify}};
});
