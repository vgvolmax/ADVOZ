'use strict';

function hashString(s){
  let h=2166136261>>>0;
  const text=String(s);
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,16777619)>>>0;
  }
  h^=h>>>16;h=Math.imul(h,0x7feb352d)>>>0;h^=h>>>15;h=Math.imul(h,0x846ca68b)>>>0;h^=h>>>16;
  return h>>>0;
}
function normalizeSeed(seed){
  if(typeof seed==='number'&&Number.isFinite(seed))return (Math.trunc(seed)>>>0)||1;
  return hashString(seed)||1;
}
function deriveSeed(rootSeed,label){return hashString(`${rootSeed>>>0}|${String(label)}`)||1}
function createRng(seed){
  const rootSeed=normalizeSeed(seed);let state=rootSeed,spare=null;
  function uniform(){
    state=(state+0x6D2B79F5)|0;
    let t=state;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  }
  function normal(){
    if(spare!==null){const x=spare;spare=null;return x}
    let u=0,v=0;while(u<=Number.EPSILON)u=uniform();while(v<=Number.EPSILON)v=uniform();
    const mag=Math.sqrt(-2*Math.log(u)),theta=2*Math.PI*v;
    spare=mag*Math.sin(theta);return mag*Math.cos(theta);
  }
  function integer(min,max){
    let lo=Math.ceil(Number(min)),hi=Math.floor(Number(max));
    if(!Number.isFinite(lo)||!Number.isFinite(hi))throw new TypeError('integer bounds must be finite');
    if(hi<lo)[lo,hi]=[hi,lo];
    return lo+Math.floor(uniform()*(hi-lo+1));
  }
  function fork(label){return createRng(deriveSeed(rootSeed,label))}
  return{seed:rootSeed,uniform,normal,integer,fork};
}
module.exports={createRng,_internals:{hashString,normalizeSeed,deriveSeed}};
