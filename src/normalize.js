(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2Normalize=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

function numberMaybe(x){
  if(x==null||x==='') return null;
  if(typeof x==='number') return Number.isFinite(x)?x:null;
  const n=Number(String(x).replace(/\s+/g,'').replace(',','.').replace(/[^0-9.+\-eE]/g,''));
  return Number.isFinite(n)?n:null;
}
function numberValue(x,f=0){ const n=numberMaybe(x); return n==null?f:n; }
function parseRuDate(v){
  const s=String(v??'').trim();
  let m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if(m) return `${m[3]}-${m[2]}-${m[1]}`;
  m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m?`${m[1]}-${m[2]}-${m[3]}`:null;
}
function normalizeOzonRows(raw,campaignId,sourceOrder=0){
  return (raw||[]).map((r,i)=>({
    campaignId:String(campaignId||r.campaignId||''),
    sourceOrder,
    sourceRow:i,
    date:parseRuDate(r['День']??r.date),
    sku:String(r['SKU']??r.sku??'').trim(),
    name:String(r['Название товара']??r.name??'').trim(),
    currentPrice:numberMaybe(r['Цена товара, ₽']??r.currentPrice),
    impressions:numberValue(r['Показы']??r.impressions),
    clicks:numberValue(r['Клики']??r.clicks),
    carts:numberValue(r['Добавления в корзину']??r.carts),
    reportedCpc:numberMaybe(r['Средняя стоимость клика, ₽']??r.reportedCpc??r.cpc),
    spend:numberMaybe(r['Расход, ₽, с НДС']??r['Расход, ₽']??r.spend),
    promotedUnits:numberValue(r['Продано товаров']??r.promotedUnits),
    promotedRevenue:numberValue(r['Продажи в продвижении, ₽']??r.promotedRevenue),
    modelUnits:numberValue(r['Продано товаров модели']??r.modelUnits),
    modelRevenue:numberValue(r['Продажи в продвижении с заказов модели, ₽']??r.modelRevenue),
    totalRevenue:numberValue(r['Заказано на сумму, ₽']??r.totalRevenue),
    addedDate:parseRuDate(r['Дата добавления']??r.addedDate)
  })).filter(r=>r.date&&r.sku);
}
function actualCpc(r){
  const clicks=numberMaybe(r?.clicks);
  const spend=numberMaybe(r?.spend);
  if(clicks>0 && spend!=null && spend>=0) return spend/clicks;
  const reported=numberMaybe(r?.reportedCpc??r?.cpc);
  return reported!=null&&reported>0?reported:null;
}
function validateAccounting(r,tolerance=.05){
  const clicks=numberMaybe(r?.clicks), spend=numberMaybe(r?.spend), reported=numberMaybe(r?.reportedCpc??r?.cpc);
  if(!(clicks>0) || spend==null || !(reported>0)) return {ok:true,relativeError:null,code:'ACCOUNTING_NOT_CHECKABLE'};
  const implied=spend/clicks;
  const relativeError=Math.abs(implied-reported)/Math.max(Math.abs(reported),1e-9);
  return {ok:relativeError<=tolerance,relativeError,code:relativeError<=tolerance?'ACCOUNTING_OK':'ACCOUNTING_MISMATCH'};
}

return {numberMaybe,numberValue,parseRuDate,normalizeOzonRows,actualCpc,validateAccounting};
});
