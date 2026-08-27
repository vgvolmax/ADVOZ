(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2UiFormat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function numeric(value){
  if(value==null||value==='') return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function cpc(value){
  const n=numeric(value);
  return n==null?'—':n.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₽';
}
function integerMoney(value){
  const n=numeric(value);
  return n==null?'—':Math.round(n).toLocaleString('ru-RU')+' ₽';
}
return {cpc,integerMoney};
});
