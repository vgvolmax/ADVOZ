(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OzonV2MultipleTesting=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function validP(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=1?n:null}
function benjaminiHochberg(items,opt={}){
  const alpha=Math.max(.001,Math.min(.5,Number(opt.alpha)||.05));
  const out=(items||[]).map(x=>({...x,qValue:null,fdrStatus:'FDR_NOT_APPLICABLE'}));
  const valid=out.map((x,i)=>({i,p:validP(x.pValue)})).filter(x=>x.p!==null).sort((a,b)=>a.p-b.p);
  const m=valid.length;if(!m)return out;
  let next=1;
  for(let k=m-1;k>=0;k--){const rank=k+1,raw=Math.min(1,valid[k].p*m/rank),q=Math.min(next,raw);next=q;out[valid[k].i].qValue=q;out[valid[k].i].fdrStatus=q<=alpha?'FDR_PASS':'FDR_NOT_PASS';}
  return out;
}
return{benjaminiHochberg,_internals:{validP}};
});
