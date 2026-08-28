(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.OzonV2ResponseCurve=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function buildResponseCurve(regimeEvidence,opt={}){
  const mergeRelative=Number.isFinite(Number(opt.mergeRelative))?Math.abs(Number(opt.mergeRelative)):.02;
  const raw=(regimeEvidence||[]).filter(x=>x&&x.usable!==false&&Number(x.cpc)>0&&Number.isFinite(Number(x.primaryMean))).map(x=>({...x,cpc:Number(x.cpc),primaryMean:Number(x.primaryMean),nDays:Math.max(1,Number(x.nDays)||1)})).sort((a,b)=>a.cpc-b.cpc);
  const groups=[];
  for(const p of raw){
    const g=groups.at(-1);
    if(g&&Math.abs(p.cpc/g.cpc-1)<=mergeRelative){
      g.items.push(p);const w=g.items.reduce((s,x)=>s+x.nDays,0);g.cpc=g.items.reduce((s,x)=>s+x.cpc*x.nDays,0)/w;g.primaryMean=g.items.reduce((s,x)=>s+x.primaryMean*x.nDays,0)/w;g.nDays=w;
    } else groups.push({cpc:p.cpc,primaryMean:p.primaryMean,nDays:p.nDays,items:[p]});
  }
  const points=groups.map(g=>({cpc:g.cpc,primaryMean:g.primaryMean,nDays:g.nDays,evidenceType:'OBSERVATIONAL'}));
  const bestPoint=points.length?points.reduce((a,b)=>b.primaryMean>a.primaryMean?b:a):null;
  function suggestDirection(currentCpc){
    if(points.length<2||!(currentCpc>0)) return null;
    let idx=0,bestDist=Infinity;
    for(let i=0;i<points.length;i++){const d=Math.abs(Math.log(points[i].cpc/currentCpc));if(d<bestDist){bestDist=d;idx=i}}
    const close=bestDist<=Math.log(1+mergeRelative*1.5);
    if(close){
      if(idx===0) return points[1].primaryMean>points[0].primaryMean?'UP':'DOWN';
      if(idx===points.length-1) return points[idx].primaryMean>points[idx-1].primaryMean?'UP':'DOWN';
      const cur=points[idx],left=points[idx-1],right=points[idx+1];
      if(left.primaryMean<=cur.primaryMean&&right.primaryMean<=cur.primaryMean) return null;
      return right.primaryMean>=left.primaryMean?'UP':'DOWN';
    }
    let lo=null,hi=null;for(const p of points){if(p.cpc<currentCpc)lo=p;else if(p.cpc>currentCpc){hi=p;break}}
    if(lo&&hi) return hi.primaryMean>lo.primaryMean?'UP':'DOWN';
    if(currentCpc>=points.at(-1).cpc) return points.at(-1).primaryMean>points.at(-2).primaryMean?'UP':'DOWN';
    return points[1].primaryMean>points[0].primaryMean?'UP':'DOWN';
  }
  return {status:points.length>=2?'READY':'INSUFFICIENT_RANGE',points,minCpc:points[0]?.cpc??null,maxCpc:points.at(-1)?.cpc??null,bestPoint,suggestDirection};
}
return {buildResponseCurve};
});
