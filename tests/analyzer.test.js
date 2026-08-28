const assert=require('assert');
const A=require('../src/analyzer.js');

function iso(start,offset){const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)}
function makeSku({cpcs,orders,price=500,reportedOverride=null}){
  return cpcs.map((cpc,i)=>{
    const clicks=[50,80,140,260,90,320,60,210,400,70,180,350,100,280][i%14];
    const q=orders[i];
    return {campaignId:'C1',sku:'S1',name:'SKU 1',date:iso('2026-06-01',i),clicks,carts:Math.max(1,Math.round(q*2)),spend:cpc*clicks,reportedCpc:reportedOverride?reportedOverride[i]:cpc,promotedUnits:2,promotedRevenue:price*2,totalRevenue:q*price,currentPrice:price};
  });
}

{
  const cpcs=[...Array(14).fill(12),...Array(14).fill(14)];
  const orders=[...Array(14).fill(80),...Array(14).fill(110)];
  const rows=makeSku({cpcs,orders});
  const [x]=A.analyzeCampaignV2(rows,{budget:{unconstrainedCv:.03,minRollingPoints:5},power:{mdeRelative:.20,maxTestDays:28},planner:{mdeRelative:.20,maxTestDays:28}});
  assert.strictEqual(x.cpcRegimes.length,2);
  assert.strictEqual(x.transitions.length,1);
  assert.strictEqual(x.transitions[0].evidenceType,'OBSERVATIONAL');
  assert.ok(['CLEAN_CPC_TRANSITION','TRANSITION_UNCERTAIN'].includes(x.transitions[0].code));
  if(x.transitions[0].code==='CLEAN_CPC_TRANSITION') assert.strictEqual(x.transitions[0].decision,'DEPLOY');
  assert.ok(x.recommendation);
}

console.log('PASS analyzer integration contract');
