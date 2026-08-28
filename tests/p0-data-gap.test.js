'use strict';
const assert=require('assert');
const T=require('../src/transitions.js');

assert.equal(T._internals.calendarGapDays('2026-06-10','2026-06-11'),0);
assert.equal(T._internals.calendarGapDays('2026-06-10','2026-06-15'),4);

const regimes=[
  {id:'R1',startDate:'2026-06-01',endDate:'2026-06-10',cpc:14},
  {id:'R2',startDate:'2026-06-15',endDate:'2026-06-25',cpc:16}
];
const budget={states:[
  {regimeId:'R1',code:'BUDGET_UNCONSTRAINED'},
  {regimeId:'R2',code:'BUDGET_UNCONSTRAINED'}
]};
const price={status:'PRICE_STABLE',daily:[
  {date:'2026-06-05',price:1000,reliable:true},
  {date:'2026-06-20',price:1000,reliable:true}
]};
const [x]=T.buildTransitions(regimes,budget,price,{maxDataGapDays:0});
assert.equal(x.code,'OTHER_CONFOUNDED_TRANSITION');
assert.equal(x.reasonCode,'DATA_GAP');
assert.equal(x.dataGapDays,4);

console.log('PASS data-gap transition contracts');
