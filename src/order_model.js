(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2Orders=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function num(x,f=0){const n=Number(x);return Number.isFinite(n)?n:f}
function dayDiff(a,b){const x=Date.parse(a+'T00:00:00Z'),y=Date.parse(b+'T00:00:00Z');return Number.isFinite(x)&&Number.isFinite(y)?Math.round((y-x)/86400000):null}
function directPrice(r){const u=num(r?.promotedUnits),rev=num(r?.promotedRevenue);return u>0&&rev>0?rev/u:null}
function buildSafeOrderSeries(rows,opt={}){
  const maxGapDays=Math.max(1,Math.round(num(opt.maxPriceGapDays,3)));
  const stableTolerance=Number.isFinite(Number(opt.stableTolerance))?Math.abs(Number(opt.stableTolerance)):.02;
  const residualTolerance=Number.isFinite(Number(opt.residualTolerance))?Math.abs(Number(opt.residualTolerance)):.02;
  const a=(rows||[]).slice().sort((x,y)=>String(x.date).localeCompare(String(y.date))).map(r=>({...r,safeOrderUnits:null,safeOrderReliable:false,safeOrderPrice:null,safeOrderSource:'unavailable'}));
  const points=[];
  for(let i=0;i<a.length;i++){const p=directPrice(a[i]);if(p>0)points.push({i,date:a[i].date,p})}
  for(let i=0;i<a.length;i++){
    const r=a[i];
    if(num(r.totalRevenue)<=0){r.safeOrderUnits=0;r.safeOrderReliable=true;r.safeOrderSource='zero-revenue';r.safeOrderResidual=0;continue}
    let p=directPrice(r),source=p>0?'direct-promoted-price':null;
    if(!(p>0)){
      let lo=null,hi=null;
      for(const z of points){if(z.i<i)lo=z;else if(z.i>i){hi=z;break}}
      if(lo&&hi&&dayDiff(lo.date,r.date)<=maxGapDays&&dayDiff(r.date,hi.date)<=maxGapDays){
        const rel=Math.abs(hi.p-lo.p)/((hi.p+lo.p)/2);
        if(rel<=stableTolerance){p=(lo.p+hi.p)/2;source='stable-sandwich-price'}
      }
    }
    if(!(p>0)) continue;
    const q=Math.max(1,Math.round(num(r.totalRevenue)/p));
    const residual=Math.abs(q*p-num(r.totalRevenue))/Math.max(num(r.totalRevenue),1);
    if(residual<=residualTolerance){r.safeOrderUnits=q;r.safeOrderReliable=true;r.safeOrderPrice=p;r.safeOrderSource=source;r.safeOrderResidual=residual}
  }
  return a;
}
return {directPrice,buildSafeOrderSeries};
});
