const assert = require('assert');
const O=require('../src/order_model.js');
const P=require('../src/price_regimes.js');
const T=require('../src/transitions.js');

function day(date,price,totalRevenue=3000){
  return {date,clicks:100,spend:1400,promotedUnits:2,promotedRevenue:2*price,totalRevenue,currentPrice:price};
}

{
  const s=O.buildSafeOrderSeries([day('2026-07-01',500,3000)]);
  assert.strictEqual(s[0].safeOrderReliable,true);
  assert.strictEqual(s[0].safeOrderUnits,6);
  assert.strictEqual(s[0].safeOrderPrice,500);
}

const d1=[1,2,3,4,5,6,7].map(n=>day(`2026-07-${String(n).padStart(2,'0')}`,500));
const d2=[8,9,10,11,12,13,14].map(n=>day(`2026-07-${String(n).padStart(2,'0')}`,500));
const r1={id:'R1',startDate:'2026-07-01',endDate:'2026-07-07',days:d1,nDays:7,cpcMedian:14};
const r2={id:'R2',startDate:'2026-07-08',endDate:'2026-07-14',days:d2,nDays:7,cpcMedian:16};

{
  const price=P.detectPriceRegimes([...d1,...d2],{stableTolerance:.02,minCoverage:.7});
  const budget={states:[
    {regimeId:'R1',code:'BUDGET_CONSTRAINED',observedCeiling:7000},
    {regimeId:'R2',code:'BUDGET_CONSTRAINED',observedCeiling:7100}
  ],changePoints:[]};
  const [tr]=T.buildTransitions([r1,r2],budget,price,{priceChangeTolerance:.03,budgetCeilingTolerance:.15});
  assert.strictEqual(tr.code,'CLEAN_CPC_TRANSITION');
  assert.strictEqual(tr.evidenceType,'OBSERVATIONAL');
}

{
  const price=P.detectPriceRegimes([...d1,...d2],{});
  const budget={states:[
    {regimeId:'R1',code:'BUDGET_CONSTRAINED',observedCeiling:7000},
    {regimeId:'R2',code:'BUDGET_CAP_CHANGED',observedCeiling:null}
  ],changePoints:[{date:'2026-07-10',regimeId:'R2'}]};
  const [tr]=T.buildTransitions([r1,r2],budget,price,{});
  assert.strictEqual(tr.code,'MIXED_CPC_BUDGET_TRANSITION');
}

{
  const expensive=d2.map(x=>({...x,promotedRevenue:x.promotedUnits*550,currentPrice:550}));
  const price=P.detectPriceRegimes([...d1,...expensive],{stableTolerance:.02,minCoverage:.7});
  const budget={states:[
    {regimeId:'R1',code:'BUDGET_UNCONSTRAINED'},
    {regimeId:'R2',code:'BUDGET_UNCONSTRAINED'}
  ],changePoints:[]};
  const [tr]=T.buildTransitions([r1,{...r2,days:expensive}],budget,price,{priceChangeTolerance:.03});
  assert.strictEqual(tr.code,'PRICE_CONFOUNDED_TRANSITION');
}

{
  const noPrice=[...d1,...d2].map(x=>({...x,promotedUnits:0,promotedRevenue:0,currentPrice:null}));
  const price=P.detectPriceRegimes(noPrice,{minCoverage:.7});
  const budget={states:[
    {regimeId:'R1',code:'BUDGET_STATE_UNCERTAIN'},
    {regimeId:'R2',code:'BUDGET_STATE_UNCERTAIN'}
  ],changePoints:[]};
  const [tr]=T.buildTransitions([r1,r2],budget,price,{});
  assert.strictEqual(tr.code,'TRANSITION_UNCERTAIN');
}

console.log('PASS order, price and observational transition contracts');
