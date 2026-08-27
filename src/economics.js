(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2Economics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function contributionProfit(row,settings={}){
  const spend=Number(row?.spend),revenue=Number(row?.totalRevenue),orders=Number(row?.safeOrderUnits??row?.orderUnitsEstimate);
  if(!Number.isFinite(spend)) return null;
  const unit=Number(settings.unitContributionBeforeAds);
  if(Number.isFinite(unit)&&Number.isFinite(orders)) return orders*unit-spend;
  const rate=Number(settings.contributionMarginRate);
  if(Number.isFinite(rate)&&rate>=0&&Number.isFinite(revenue)) return revenue*rate-spend;
  return null;
}
return {contributionProfit};
});
