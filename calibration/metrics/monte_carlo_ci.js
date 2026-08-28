'use strict';
const {normalQuantile}=require('../../src/power.js');

function wilsonInterval(successes,total,level=.95){
  const s=Math.max(0,Number(successes)||0),n=Math.max(0,Number(total)||0),lv=Math.max(.5,Math.min(.9999,Number(level)||.95));
  if(n===0)return{estimate:null,low:null,high:null,successes:s,total:n,level:lv};
  const p=s/n,z=normalQuantile(.5+lv/2),z2=z*z,den=1+z2/n,center=(p+z2/(2*n))/den,half=z*Math.sqrt((p*(1-p)+z2/(4*n))/n)/den;
  return{estimate:p,low:Math.max(0,center-half),high:Math.min(1,center+half),successes:s,total:n,level:lv};
}
function meanFinite(values){const a=(values||[]).filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
module.exports={wilsonInterval,meanFinite};
