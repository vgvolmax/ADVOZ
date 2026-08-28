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
function applyFdrToCampaign(analyses,opt={}){
  const alpha=Math.max(.001,Math.min(.5,Number(opt.alpha)||.05)),flat=[];
  for(let ai=0;ai<(analyses||[]).length;ai++)for(let ti=0;ti<(analyses[ai].transitions||[]).length;ti++)flat.push({ai,ti,pValue:analyses[ai].transitions[ti]?.uncertainty?.pValue});
  const adjusted=benjaminiHochberg(flat,{alpha}),familySize=adjusted.filter(x=>validP(x.pValue)!==null).length;
  const by=new Map(adjusted.map(x=>[`${x.ai}:${x.ti}`,x]));
  return (analyses||[]).map((a,ai)=>({...a,transitions:(a.transitions||[]).map((t,ti)=>{
    const x=by.get(`${ai}:${ti}`)||{qValue:null,fdrStatus:'FDR_NOT_APPLICABLE'},out={...t,qValue:x.qValue,fdrStatus:x.fdrStatus,fdrFamilySize:familySize};
    if((t.decision==='DEPLOY'||t.decision==='ROLLBACK')&&x.fdrStatus!=='FDR_PASS'){
      out.decisionBeforeFdr=t.decision;out.decision='INCONCLUSIVE';out.decisionReason='Сильное observational-решение не проходит campaign-wide BH/FDR safeguard.';
    }
    return out;
  })}));
}
return{benjaminiHochberg,applyFdrToCampaign,_internals:{validP}};
});
