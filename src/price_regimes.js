(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./order_model.js'):root.OzonV2Orders);
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2PriceRegimes=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(O){
'use strict';
if(!O) throw new Error('order_model.js must be loaded before price_regimes.js');
function median(a){const v=(a||[]).filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2}
function detectPriceRegimes(days,opt={}){
  const stableTolerance=Number.isFinite(Number(opt.stableTolerance))?Math.abs(Number(opt.stableTolerance)):.02;
  const minCoverage=Number.isFinite(Number(opt.minCoverage))?Number(opt.minCoverage):.70;
  const safe=O.buildSafeOrderSeries(days,opt);
  const daily=safe.map(r=>{
    const direct=O.directPrice(r);
    if(direct>0) return {date:r.date,price:direct,reliable:true,source:'direct-promoted-price'};
    if(r.safeOrderReliable&&r.safeOrderPrice>0) return {date:r.date,price:r.safeOrderPrice,reliable:true,source:r.safeOrderSource};
    const cp=Number(r.currentPrice);
    return Number.isFinite(cp)&&cp>0?{date:r.date,price:cp,reliable:false,source:'current-price'}:{date:r.date,price:null,reliable:false,source:'unavailable'};
  });
  const reliable=daily.filter(x=>x.reliable&&x.price>0),coverage=daily.length?reliable.length/daily.length:0;
  const regimes=[];
  for(const p of reliable){
    if(!regimes.length){regimes.push({id:'P1',startDate:p.date,endDate:p.date,points:[p],price:p.price});continue}
    const cur=regimes.at(-1),m=median(cur.points.map(x=>x.price)),rel=Math.abs(p.price/m-1);
    if(rel<=stableTolerance){cur.points.push(p);cur.endDate=p.date;cur.price=median(cur.points.map(x=>x.price))}
    else regimes.push({id:`P${regimes.length+1}`,startDate:p.date,endDate:p.date,points:[p],price:p.price});
  }
  return {daily,regimes,coverage,status:coverage>=minCoverage?'PRICE_OK':'PRICE_DATA_INSUFFICIENT',stableTolerance,minCoverage};
}
return {detectPriceRegimes,_internals:{median}};
});
