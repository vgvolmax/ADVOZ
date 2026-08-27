(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./normalize.js'):root.OzonV2Normalize);
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2CpcRegimes=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(N){
'use strict';
if(!N) throw new Error('normalize.js must be loaded before cpc_regimes.js');

function median(a){
  const v=(a||[]).filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if(!v.length) return null;
  const m=Math.floor(v.length/2);
  return v.length%2?v[m]:(v[m-1]+v[m])/2;
}
function mean(a){ const v=(a||[]).filter(Number.isFinite); return v.length?v.reduce((s,x)=>s+x,0)/v.length:null; }
function sd(a){ const v=(a||[]).filter(Number.isFinite); if(v.length<2) return 0; const m=mean(v); return Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1)); }
function mad(a){ const m=median(a); return m==null?0:median((a||[]).filter(Number.isFinite).map(x=>Math.abs(x-m)))||0; }
function robustLogNoise(cpcs){
  const logs=cpcs.filter(x=>x>0).map(Math.log), d=[];
  for(let i=1;i<logs.length;i++) d.push(logs[i]-logs[i-1]);
  if(!d.length) return .005;
  return Math.max(.005,1.4826*mad(d)/Math.sqrt(2));
}
function regimeSummary(id,segment){
  const cpcs=segment.map(x=>x.cpc), clicks=segment.reduce((s,x)=>s+(Number(x.row.clicks)||0),0);
  let spend=0,haveSpend=false;
  for(const x of segment){ if(Number.isFinite(Number(x.row.spend))){spend+=Number(x.row.spend);haveSpend=true;} }
  const weighted=haveSpend&&clicks>0?spend/clicks:null;
  return {
    id:`R${id}`,
    startDate:segment[0].row.date,
    endDate:segment.at(-1).row.date,
    days:segment.map(x=>x.row),
    nDays:segment.length,
    cpc:weighted??median(cpcs),
    cpcMedian:median(cpcs),
    cpcSd:sd(cpcs),
    clicks
  };
}
function detectCpcRegimes(days,opt={}){
  const minDays=Math.max(3,Math.round(Number(opt.minDays)||4));
  const minRelativeChange=Math.max(0,Number.isFinite(Number(opt.minRelativeChange))?Math.abs(Number(opt.minRelativeChange)):.05);
  const noiseMultiplier=Math.max(1,Number(opt.noiseMultiplier)||2.5);
  const pts=(days||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(row=>({row,cpc:N.actualCpc(row)})).filter(x=>x.cpc>0);
  if(!pts.length) return {regimes:[],noise:null,changePoints:[]};
  if(pts.length<minDays*2) return {regimes:[regimeSummary(1,pts)],noise:robustLogNoise(pts.map(x=>x.cpc)),changePoints:[]};

  const globalNoise=robustLogNoise(pts.map(x=>x.cpc));
  const segments=[];
  let start=0;
  while(start<pts.length){
    if(pts.length-start<minDays*2){ segments.push(pts.slice(start)); break; }
    let split=null;
    for(let j=start+minDays;j<=pts.length-minDays;j++){
      const base=pts.slice(start,j);
      const cand=pts.slice(j,j+minDays);
      const bmed=median(base.map(x=>x.cpc)), cmed=median(cand.map(x=>x.cpc));
      if(!(bmed>0&&cmed>0)) continue;
      const rel=Math.abs(Math.log(cmed/bmed));
      const baseLogs=base.map(x=>Math.log(x.cpc)), localNoise=Math.max(globalNoise,1.4826*mad(baseLogs));
      const threshold=Math.max(Math.log(1+minRelativeChange),noiseMultiplier*localNoise);
      const direction=Math.sign(Math.log(cmed/bmed));
      const sustained=cand.every(x=>{
        const d=Math.log(x.cpc/bmed);
        return Math.sign(d)===direction && Math.abs(d)>=threshold*.6;
      });
      if(rel>=threshold && sustained){ split=j; break; }
    }
    if(split==null){ segments.push(pts.slice(start)); break; }
    segments.push(pts.slice(start,split));
    start=split;
  }

  const merged=[];
  for(const seg of segments){
    if(!merged.length){ merged.push(seg); continue; }
    const prev=merged.at(-1), a=median(prev.map(x=>x.cpc)), b=median(seg.map(x=>x.cpc));
    const rel=Math.abs(Math.log(b/a)), threshold=Math.max(Math.log(1+minRelativeChange),noiseMultiplier*globalNoise);
    if(seg.length<minDays || rel<threshold) prev.push(...seg); else merged.push(seg);
  }
  const regimes=merged.map((s,i)=>regimeSummary(i+1,s));
  const changePoints=regimes.slice(1).map((r,i)=>({date:r.startDate,fromRegime:regimes[i].id,toRegime:r.id,fromCpc:regimes[i].cpcMedian,toCpc:r.cpcMedian,relativeChange:r.cpcMedian/regimes[i].cpcMedian-1}));
  return {regimes,noise:globalNoise,changePoints,minDays,minRelativeChange,noiseMultiplier};
}

return {detectCpcRegimes,_internals:{median,mad,robustLogNoise}};
});
